import { DAILY_ANALYSES, nextReset, type Quota } from './contracts';

export type Ticket = { id: string; account: string; payloadHash: string; started: number; status: 'pending' | 'done' | 'failed'; dispatched: boolean; result?: unknown };
export type Ledger = { day: string; used: Record<string, number>; attempts: Record<string, number>; tickets: Record<string, Ticket>; consumed: number };
export const RESOURCE_RESERVATION = 150; // Conservative admission budget; not measured provider metering.
export const RESOURCE_CAP = 9000; // Margin below 10,000 neurons; unrelated account usage is not automatically known.
export function ledgerFor(now: number): Ledger { return { day: new Date(now).toISOString().slice(0, 10), used: {}, attempts: {}, tickets: {}, consumed: 0 }; }
export function advanceLedger(old: Ledger | undefined, now: number): Ledger {
  const today = ledgerFor(now);
  if (!old || old.day === today.day) return old ?? today;
  // Retain recent IDs for idempotent replay and keep in-flight requests locked at midnight.
  today.tickets = Object.fromEntries(Object.entries(old.tickets).filter(([, ticket]) => now - ticket.started < 86400000));
  recoverExpired(today, now);
  today.consumed = Object.values(today.tickets).filter(ticket => ticket.status === 'pending').length * RESOURCE_RESERVATION;
  return today;
}
export function quotaFor(ledger: Ledger, account: string, now: number, available = true): Quota {
  const pending = Object.values(ledger.tickets).some(t => t.account === account && t.status === 'pending');
  return { remaining: Math.max(0, DAILY_ANALYSES - (ledger.used[account] ?? 0) - (pending ? 1 : 0)), reserved: pending ? 1 : 0, resetsAt: nextReset(now), scope: 'browser', available: available && ledger.consumed + RESOURCE_RESERVATION <= RESOURCE_CAP };
}
export function recoverExpired(ledger: Ledger, now: number) {
  for (const ticket of Object.values(ledger.tickets)) if (ticket.status === 'pending' && now - ticket.started > 60000) ticket.status = 'failed';
  // Resource reservations are never refunded after dispatch/uncertain outcomes.
}
export function reserve(ledger: Ledger, account: string, requestId: string, payloadHash: string, now: number) {
  recoverExpired(ledger, now);
  const existing = ledger.tickets[requestId];
  if (existing) {
    if (existing.account !== account || existing.payloadHash !== payloadHash) throw new Error('ID permintaan sudah digunakan untuk data lain.');
    return { ticket: existing, fresh: false };
  }
  const quota = quotaFor(ledger, account, now);
  if (quota.reserved) throw new Error('Satu analisis masih diproses. Tunggu hasilnya.');
  if (quota.remaining <= 0) throw new Error('Kuota analisis hari ini habis.');
  if (!quota.available) throw new Error('Alokasi layanan bersama sementara habis. Sisa pribadi tidak berkurang.');
  if ((ledger.attempts[account] ?? 0) >= 10) throw new Error('Terlalu banyak percobaan hari ini. Bantuan aplikasi tetap tersedia.');
  ledger.attempts[account] = (ledger.attempts[account] ?? 0) + 1;
  ledger.consumed += RESOURCE_RESERVATION;
  const ticket: Ticket = { id: requestId, account, payloadHash, started: now, status: 'pending', dispatched: false };
  ledger.tickets[requestId] = ticket;
  return { ticket, fresh: true };
}
export function finish(ledger: Ledger, requestId: string, result: unknown | null) {
  const ticket = ledger.tickets[requestId];
  if (!ticket || ticket.status !== 'pending') return false;
  if (result === null) { ticket.status = 'failed'; return true; }
  ticket.status = 'done'; ticket.result = result;
  if (new Date(ticket.started).toISOString().slice(0, 10) === ledger.day) ledger.used[ticket.account] = (ledger.used[ticket.account] ?? 0) + 1;
  return true;
}
