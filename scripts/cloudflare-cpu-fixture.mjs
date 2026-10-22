// Synthetic fixture only. No database, real identities, credentials or outbound requests.
export const syntheticCookie = "access_token=synthetic-cpu; refresh_token=synthetic-cpu; ekavyu_session=1";
const socketPaths = new Set(["/api/ws", "/api/notifications/ws", "/api/clinical/ws", "/api/queue/ws"]);
const doctor = {
  id: "synthetic-doctor", slug: "synthetic-doctor", name: "Synthetic Doctor",
  specialization: "General Medicine", qualification: "Fixture", experienceYears: 1,
  description: "Synthetic SSR fixture", imageUrl: null, languages: ["English"],
  organizationName: "Synthetic Clinic", organizationLogo: null, currency: "INR", locations: [],
};
const fixtureWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = { "Cache-Control": "no-store", "X-Ekavyu-Fixture": "synthetic-only" };
    const json = (body, status = 200) => Response.json(body, { status, headers });
    const authenticated = request.headers.get("Cookie") === syntheticCookie;
    const origin = request.headers.get("Origin");
    if (origin && origin !== env.APP_URL) return json({ error: "Origin denied" }, 403);
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      if (!socketPaths.has(url.pathname)) return json({ error: "Not found" }, 404);
      if (url.pathname !== "/api/queue/ws" && !authenticated) return json({ error: "Unauthorized" }, 401);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      server.addEventListener("message", event => server.send(event.data));
      server.addEventListener("close", event => server.close(event.code === 1005 ? 1000 : event.code, event.reason));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === "/api/auth/me") {
      if (!authenticated) return json({ success: false }, 401);
      if (url.searchParams.get("delay") === "150") await new Promise(resolve => setTimeout(resolve, 150));
      return json({ success: true, data: { id: "synthetic", role: "doctor", organization_id: "synthetic" } });
    }
    if (url.pathname === "/api/public/doctors/synthetic-doctor/profile") return json({ data: doctor });
    if (url.pathname === "/api/public/doctors/synthetic-large/profile") {
      return json({ data: { ...doctor, slug: "synthetic-large", description: "Synthetic public profile. ".repeat(300) } });
    }
    if (url.pathname === "/api/fixture/security" && request.method === "POST") {
      if (origin !== env.APP_URL) return json({ error: "Origin required" }, 403);
      if (!authenticated) return json({ error: "Unauthorized" }, 401);
      const cookieHeaders = new Headers(headers);
      for (const value of ["access_token=synthetic-cpu; HttpOnly", "refresh_token=synthetic-cpu; HttpOnly", "ekavyu_session=1"]) {
        cookieHeaders.append("Set-Cookie", `${value}; Path=/; Secure; SameSite=Lax`);
      }
      return Response.json({ cookiePreserved: true, originPreserved: true }, { headers: cookieHeaders });
    }
    if (url.pathname === "/api/fixture/redirect") return new Response(null, { status: 307, headers: { ...headers, Location: "/login" } });
    return json({ error: "Synthetic fixture has no such route" }, 404);
  },
};
export default fixtureWorker;
