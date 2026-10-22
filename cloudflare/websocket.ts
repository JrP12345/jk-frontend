const socketPaths = new Set([
  "/api/ws",
  "/api/notifications/ws",
  "/api/clinical/ws",
  "/api/queue/ws",
]);

/** Pass the native upgrade through; Fastify remains the authentication authority. */
export async function forwardWebSocket(request: Request, backendOrigin: string): Promise<Response> {
  const incoming = new URL(request.url);
  if (!socketPaths.has(incoming.pathname)) return new Response("Not Found", { status: 404 });
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });

  // Assign path/search individually so neither a query value nor a // path can
  // select another host. The upstream comes only from the Worker configuration.
  const upstream = new URL(backendOrigin);
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;
  const headers = new Headers(request.headers);
  headers.set("Host", upstream.host);
  try {
    // Keep Cookie, Origin, Authorization and Sec-WebSocket-* intact. Do not accept,
    // clone, rebuild or inspect the upgraded response: workerd tunnels frames,
    // subprotocol negotiation and both peers' close frames without a JS relay.
    return await fetch(new Request(upstream, { method: "GET", headers, redirect: "manual", signal: request.signal }));
  } catch {
    // Never log the request URL/headers: they may contain legacy credentials.
    return new Response("Bad Gateway", { status: 502 });
  }
}
