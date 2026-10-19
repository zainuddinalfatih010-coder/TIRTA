import { describe, expect, it, vi } from 'vitest';
import worker, { TirtaQuota, type QuotaStorage, type AssistantEnv } from './server';
import { finish, ledgerFor, quotaFor, reserve, RESOURCE_CAP, type Ledger } from './quotaLedger';

class TestStorage implements QuotaStorage {
  data = new Map<string, unknown>();
  private tail: Promise<unknown> = Promise.resolve();
  async get<T>(key: string): Promise<T | undefined> { return structuredClone(this.data.get(key)) as T | undefined; }
  async put(key: string, value: unknown) { this.data.set(key, structuredClone(value)); }
  transaction<T>(callback: (storage: QuotaStorage) => Promise<T>): Promise<T> {
    const operation = this.tail.then(() => callback(this)); this.tail = operation.catch(() => {}); return operation;
  }
}
const now = Date.UTC(2026, 9, 5, 23, 59);
const body = () => ({ requestId: crypto.randomUUID(), question: 'Analisis mendalam untuk paket', fingerprint: 'event-ledger-v1:fixture', scenarioId: 'rain-50', priority: 'residual', candidates: [], baseline: null });
const request = (payload: unknown, account = 'pilot-browser') => new Request('https://tirta.test/api/tirta-ai/analysis', { method: 'POST', headers: { 'X-Tirta-Session': account }, body: JSON.stringify(payload) });
const valid = () => ({ response: JSON.stringify({ explanation: 'Data belum cukup untuk menilai paket. Nyatakan kapasitas, biaya, dan kondisi sambungan terlebih dahulu.', sourceIds: ['METHOD-EPA-VOLUME'], candidateId: null }) });

describe('server quota, no live model invoked by these tests', () => {
  it.each([
    ['residual', 'runoff'], ['cost', 'cheap'], ['area', 'small'],
  ] as const)('accepts structured JSON and follows declared %s priority', async (priority, id) => {
    const ai = { run: vi.fn(async () => ({ response: { explanation: 'Paket memenuhi prioritas yang dinyatakan. Kondisi lapangan dan sumber kapasitas masih perlu diperiksa.', sourceIds: ['METHOD-EPA-VOLUME'], candidateId: id } })) };
    const service = new TirtaQuota({ storage: new TestStorage() }, { AI: ai }, () => now);
    const candidates = [
      { id: 'runoff', name: 'Runoff', residual: 1, cost: 9000, area: 8, checks: [] },
      { id: 'cheap', name: 'Cheap', residual: 4, cost: 1000, area: 4, checks: [] },
      { id: 'small', name: 'Small', residual: 3, cost: 3000, area: 1, checks: [] },
    ];
    const response = await service.fetch(request({ ...body(), priority, candidates, baseline: 5 }));
    expect(response.status).toBe(200); expect((await response.json()).candidateId).toBe(id);
    expect(JSON.parse((ai.run.mock.calls[0] as unknown as [string, { messages: { content: string }[] }])[1].messages[1]!.content).priority).toBe(priority);
  });
  it.each([
    { id: 'expensive', text: 'Paket ini sesuai prioritas.' },
    { id: 'cheap', text: 'Kapasitasnya pasti 999 m³.' },
    { id: 'cheap', text: 'Paket ini menjamin tidak ada genangan.' },
    { id: 'cheap', text: 'Dasarnya https://invented.test/journal.' },
  ])('rejects an inconsistent choice or unsupported prose: $text', async ({ id, text }) => {
    const ai = { run: vi.fn(async () => ({ response: { explanation: text, sourceIds: ['METHOD-EPA-VOLUME'], candidateId: id } })) };
    const service = new TirtaQuota({ storage: new TestStorage() }, { AI: ai }, () => now);
    const response = await service.fetch(request({ ...body(), priority: 'cost', baseline: 5, candidates: [{ id: 'cheap', name: 'A', residual: 4, cost: 1000, area: 1, checks: [] }, { id: 'expensive', name: 'B', residual: 1, cost: 8000, area: 2, checks: [] }] }));
    expect(response.status).toBe(422); expect((await response.json()).quota.remaining).toBe(5);
  });
  it('preserves equal priorities and withholds recommendations for UNKNOWN or zero baseline', async () => {
    const ai = { run: vi.fn(async () => ({ response: { explanation: 'Beberapa paket memenuhi prioritas yang sama.', sourceIds: ['METHOD-EPA-VOLUME'], candidateId: 'b' } })) };
    const service = new TirtaQuota({ storage: new TestStorage() }, { AI: ai }, () => now);
    const payload = { ...body(), baseline: 5, candidates: [{ id: 'a', name: 'A', residual: 1, cost: 4000, area: 2, checks: [] }, { id: 'b', name: 'B', residual: 1, cost: 5000, area: 1, checks: [] }] };
    expect((await service.fetch(request(payload))).status).toBe(200);
    expect((await service.fetch(request({ ...payload, requestId: crypto.randomUUID(), baseline: null }))).status).toBe(422);
    expect((await service.fetch(request({ ...payload, requestId: crypto.randomUUID(), baseline: 0 }))).status).toBe(422);
  });
  it('commits five successful analyses, denies sixth before inference and replays identical request without double debit', async () => {
    const ai = { run: vi.fn(async () => valid()) }, store = new TestStorage(), service = new TirtaQuota({ storage: store }, { AI: ai }, () => now);
    const first = body();
    expect((await service.fetch(request(first))).status).toBe(200);
    expect((await service.fetch(request(first))).status).toBe(200);
    expect(ai.run).toHaveBeenCalledTimes(1);
    for (let n = 0; n < 4; n++) expect((await service.fetch(request(body()))).status).toBe(200);
    const sixth = await service.fetch(request(body())); expect(sixth.status).toBe(429);
    expect((await sixth.json()).quota.remaining).toBe(0); expect(ai.run).toHaveBeenCalledTimes(5);
  });
  it('serializes concurrent requests and returns only one reservation', async () => {
    let resolve!: (value: unknown) => void;
    const ai = { run: vi.fn(() => new Promise(r => { resolve = r; })) }, service = new TirtaQuota({ storage: new TestStorage() }, { AI: ai }, () => now);
    const first = service.fetch(request(body()));
    await vi.waitFor(() => expect(ai.run).toHaveBeenCalledTimes(1));
    expect((await service.fetch(request(body()))).status).toBe(429);
    resolve(valid()); expect((await first).status).toBe(200);
  });
  it('keeps an in-flight request across midnight and replays it without charging the new day', async () => {
    let clock = now + 59000;
    let resolve!: (value: unknown) => void;
    const ai = { run: vi.fn(() => new Promise(r => { resolve = r; })) };
    const service = new TirtaQuota({ storage: new TestStorage() }, { AI: ai }, () => clock);
    const payload = body(), pending = service.fetch(request(payload));
    await vi.waitFor(() => expect(ai.run).toHaveBeenCalledTimes(1));
    clock += 2000;
    expect((await service.fetch(request(body()))).status).toBe(429);
    resolve(valid());
    const completed = await pending;
    expect(completed.status).toBe(200); expect((await completed.json()).quota.remaining).toBe(5);
    const replay = await service.fetch(request(payload));
    expect(replay.status).toBe(200); expect((await replay.json()).quota.remaining).toBe(5);
    expect(ai.run).toHaveBeenCalledTimes(1);
  });
  it('refunds personal failures, keeps global reservations, and rejects fabricated sources/actions', async () => {
    const store = new TestStorage(), ai = { run: vi.fn(async () => ({ response: JSON.stringify({ explanation: 'Wrong', sourceIds: ['invented'], candidateId: 'fabricated' }) })) };
    const service = new TirtaQuota({ storage: store }, { AI: ai }, () => now);
    const failed = await service.fetch(request(body())); expect(failed.status).toBe(422);
    expect((await failed.json()).quota.remaining).toBe(5);
    expect((await store.get<Ledger>('day'))!.consumed).toBeGreaterThan(0);
    expect((await service.fetch(request({ ...body(), question: '' }))).status).toBe(400); expect(ai.run).toHaveBeenCalledTimes(1);
  });
  it('resets from server UTC, recovers uncertain pending slots and blocks global exhaustion without debiting personal quota', () => {
    const ledger = ledgerFor(now); reserve(ledger, 'a', 'one', 'hash', now);
    expect(quotaFor(ledger, 'a', now).remaining).toBe(4);
    finish(ledger, 'one', null); expect(quotaFor(ledger, 'a', now).remaining).toBe(5);
    ledger.consumed = RESOURCE_CAP;
    expect(() => reserve(ledger, 'b', 'two', 'hash', now)).toThrow(/bersama/);
    expect(quotaFor(ledger, 'b', now).remaining).toBe(5);
    expect(quotaFor(ledgerFor(now + 60000), 'a', now + 60000).resetsAt).toBe('2026-10-07T00:00:00.000Z');
    const pending = ledgerFor(now); reserve(pending, 'a', 'three', 'hash', now);
    reserve(pending, 'a', 'four', 'hash', now + 61000);
    expect(pending.tickets.three?.status).toBe('failed');
  });
  it('does not allow reuse of one request ID with altered content and caps failed retries', async () => {
    const service = new TirtaQuota({ storage: new TestStorage() }, { AI: { run: async () => ({ response: 'invalid' }) } }, () => now);
    const first = body(); await service.fetch(request(first));
    expect((await service.fetch(request({ ...first, question: 'Other payload' }))).status).toBe(429);
    for (let n = 0; n < 9; n++) await service.fetch(request(body()));
    expect((await service.fetch(request(body()))).status).toBe(429);
  });
  it('public binding is fail closed, same-origin only, and never trusts a user supplied identity header', async () => {
    const ai = { run: vi.fn() }, downstream = vi.fn(async (r: Request) => Response.json({ identity: r.headers.get('X-Tirta-Session') }));
    const env: AssistantEnv = { AI: ai, ENABLE_MODEL: 'false', PILOT_SECRET: 'private-test-only-secret-not-a-live-token', QUOTA: { idFromName: x => x, get: () => ({ fetch: downstream }) } };
    expect((await worker.fetch(new Request('https://tirta.test/api/tirta-ai/status'), env)).status).toBe(503); expect(downstream).not.toHaveBeenCalled();
    env.ENABLE_MODEL = 'true';
    const malicious = new Request('https://tirta.test/api/tirta-ai/analysis', { method: 'POST', headers: { Origin: 'https://evil.test' }, body: '{}' });
    expect((await worker.fetch(malicious, env)).status).toBe(403);
    const identityResponse = await worker.fetch(new Request('https://tirta.test/api/tirta-ai/status', { headers: { 'X-Tirta-Session': 'admin' } }), env);
    expect((await identityResponse.json()).identity).not.toBe('admin'); expect(identityResponse.headers.get('Set-Cookie')).toContain('HttpOnly'); expect(ai.run).not.toHaveBeenCalled();
  });
});
