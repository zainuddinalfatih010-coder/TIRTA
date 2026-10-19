type Env = { TIRTA_AI?: { fetch(request: Request): Promise<Response> } };
export async function onRequest({ request }: { request: Request; env: Env }): Promise<Response> {
  const status = new URL(request.url).pathname.endsWith('/status');
  // The pilot uses local, deterministic guidance. Never forward to a model service.
  return Response.json({ mode: 'local', connected: false, message: 'Gunakan Panduan lokasi di TIRTA. Analisis generatif tidak digunakan.' }, { status: status ? 200 : 410, headers: { 'Cache-Control': 'no-store' } });
}
