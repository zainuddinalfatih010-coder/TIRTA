import { it, expect } from 'vitest';
import { onRequest } from '../../functions/api/tirta-ai/[[path]]';

it('the published candidate endpoint never forwards a request to a model binding', async () => {
  let calls = 0;
  const env = { TIRTA_AI: { fetch: async () => { calls++; throw new Error('Model must stay unused'); } } };
  const response = await onRequest({ request: new Request('https://example.test/api/tirta-ai/analysis', { method: 'POST', body: '{}' }), env });
  expect(response.status).toBe(410); expect(calls).toBe(0);
});
it('status describes local guidance without quotas or a remote connection', async () => {
  const response = await onRequest({ request: new Request('https://example.test/api/tirta-ai/status'), env: {} });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ mode: 'local', connected: false });
});
