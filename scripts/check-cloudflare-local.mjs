// Run after building with BACKEND_INTERNAL_URL=http://127.0.0.1:5099 and starting
// vite preview on 127.0.0.1:8787. Never connects to Render or MongoDB.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { once } from "node:events";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

// Use the installed Cloudflare tooling's WebSocket implementation, no new dependency.
const require = createRequire(import.meta.resolve("@cloudflare/vite-plugin"));
const { WebSocket, WebSocketServer } = require("ws");
const { forwardWebSocket } = await import("../cloudflare/websocket.ts");
const base = "http://127.0.0.1:8787";
const origin = "https://dev.ekavyu.com";
const key = randomBytes(32);
const sign = payload => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
};
const good = sign({ role: "doctor", tenant: "synthetic", exp: Date.now() + 60_000 });
const cookie = `access_token=${good}; refresh_token=synthetic; ekavyu_session=1`;
const requests = [];
const closes = [];
const wss = new WebSocketServer({ noServer: true });
const server = createServer(async (req, res) => {
  requests.push({ path: req.url, headers: req.headers });
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/api/auth/login") {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", [
      `access_token=${good}; Path=/; HttpOnly; Secure; SameSite=None`,
      "refresh_token=synthetic; Path=/; HttpOnly; Secure; SameSite=None",
      "ekavyu_session=1; Path=/; Secure; SameSite=None",
    ]);
  }
  if (req.url === "/api/fixture/redirect") {
    res.writeHead(307, { Location: "/api/fixture/destination", "Set-Cookie": "fixture=1; Path=/; HttpOnly; Secure" });
    return res.end();
  }
  if (req.url.startsWith("/api/public/doctors/")) {
    if (!req.url.includes("synthetic-doctor")) { res.statusCode = 404; return res.end("{}"); }
    return res.end(JSON.stringify({ data: { id: "synthetic", slug: "synthetic-doctor", name: "Synthetic Doctor", specialization: "General Medicine", qualification: "Fixture", experienceYears: 1, description: "Synthetic SSR fixture", imageUrl: null, languages: ["English"], organizationName: "Fixture Clinic", organizationLogo: null, currency: "INR", locations: [] } }));
  }
  if (req.method === "POST" && req.url === "/api/fixture/mutate" && req.headers.origin !== origin) {
    res.statusCode = 403;
    return res.end('{"error":"Invalid CSRF origin"}');
  }
  res.end(JSON.stringify({ ok: true, path: req.url, origin: req.headers.origin, hasCookie: !!req.headers.cookie, authorization: req.headers.authorization }));
});
server.on("upgrade", (req, socket, head) => {
  socket.on("error", () => {});
  requests.push({ path: req.url, headers: req.headers });
  if (req.url.includes("rejectHandshake=1")) {
    socket.end("HTTP/1.1 401 Unauthorized\r\nSet-Cookie: fixture=; Path=/; Max-Age=0\r\nContent-Length: 0\r\n\r\n");
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => {
    const token = /(?:^|;\s*)access_token=([^;]+)/.exec(req.headers.cookie || "")?.[1] || req.headers.authorization?.replace(/^Bearer /, "");
    let identity;
    try {
      const [body, signature] = token.split(".");
      if (signature === createHmac("sha256", key).update(body).digest("base64url")) identity = JSON.parse(Buffer.from(body, "base64url"));
    } catch { /* Invalid synthetic credential. */ }
    const publicQueue = req.url.startsWith("/api/queue/ws");
    // A synthetic upstream models the actual backend's post-upgrade denials.
    // The real JWT/session/database authority remains independently in Fastify.
    if (!publicQueue && (req.headers.origin !== origin || !identity || identity.exp < Date.now())) {
      ws.close(req.url.startsWith("/api/clinical/ws") ? 4001 : 1008, "Unauthorized");
      return;
    }
    if (req.url.startsWith("/api/clinical/ws") && identity.tenant !== "synthetic") {
      ws.close(4003, "Forbidden");
      return;
    }
    ws.on("message", (data, binary) => {
      if (!binary && data.toString() === "REVOKE") ws.close(4001, "Session expired or revoked");
      else ws.send(data, { binary });
    });
    ws.on("close", (code, reason) => closes.push({ code, reason: reason.toString() }));
    ws.send("CONNECTED");
  });
});

async function socketCheck(route, { credential = cookie, suppliedOrigin = origin, authorization, protocol, code = 1000 } = {}) {
  const ws = new WebSocket(base.replace("http:", "ws:") + route, protocol ? [protocol] : [], { headers: { ...(credential ? { Cookie: credential } : {}), ...(suppliedOrigin ? { Origin: suppliedOrigin } : {}), ...(authorization ? { Authorization: authorization } : {}) }, handshakeTimeout: 5000 });
  const timeout = setTimeout(() => ws.terminate(), 7000);
  try {
    const closed = once(ws, "close");
    if (code === 1008 || code === 4003 || (code === 4001 && credential !== cookie)) {
      const [actual] = await closed;
      assert.equal(actual, code);
      return;
    }
    const connected = once(ws, "message");
    await once(ws, "open");
    assert.equal((await connected)[0].toString(), "CONNECTED");
    if (protocol) assert.equal(ws.protocol, protocol);
    let message = once(ws, "message");
    ws.send("PING");
    assert.equal((await message)[0].toString(), "PING");
    message = once(ws, "message");
    ws.send(Buffer.from([0, 1, 255]));
    const [binary, isBinary] = await message;
    assert.equal(isBinary, true);
    assert.deepEqual(binary, Buffer.from([0, 1, 255]));
    if (code === 4001) ws.send("REVOKE");
    else ws.close(1000, "fixture done");
    const [actual, reason] = await closed;
    assert.equal(actual, code);
    assert.equal(reason.toString(), code === 4001 ? "Session expired or revoked" : "fixture done");
  } finally { clearTimeout(timeout); ws.terminate(); }
}

// The installed Vite preview bridge destroys non-101 upgrade responses. Check
// rejection response identity at the forwarding boundary; native 101 upgrades
// above are exercised end to end through the actual built Worker.
async function rejectedHandshake(route, status) {
  const originalFetch = globalThis.fetch;
  const rejection = new Response(null, { status: 401, headers: { "Set-Cookie": "fixture=; Path=/; Max-Age=0" } });
  let called = false;
  globalThis.fetch = async () => { called = true; return rejection; };
  try {
    const response = await forwardWebSocket(new Request(base + route, { headers: { Upgrade: "websocket", Cookie: cookie, Origin: origin } }), "http://127.0.0.1:5099");
    assert.equal(response.status, status);
    if (status === 401) {
      assert.equal(response, rejection);
      assert.deepEqual(response.headers.getSetCookie(), ["fixture=; Path=/; Max-Age=0"]);
    } else assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

let passed = 0;
async function check(name, run) {
  if (process.argv[2] && !new RegExp(process.argv[2]).test(name)) return;
  await run(); passed++; console.log(`PASS ${name}`);
}
await new Promise(resolve => server.listen(5099, "127.0.0.1", resolve));
try {
  await check("HTTP cookies, Origin, authorization and multiple Set-Cookie", async () => {
    const response = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { Cookie: cookie, Origin: origin, Authorization: "Bearer synthetic-header" } });
    assert.equal(response.status, 200);
    const values = response.headers.getSetCookie();
    assert.equal(values.length, 3);
    assert.ok(values.every(value => value.includes("Secure") && value.includes("Path=/") && !value.includes("Domain=")));
    assert.ok(values[0].includes("HttpOnly"));
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.origin, origin); assert.equal(body.hasCookie, true); assert.equal(body.authorization, "Bearer synthetic-header");
  });
  await check("CSRF origin reaches upstream unchanged", async () => {
    for (const [value, expected] of [[origin, 200], ["https://evil.invalid", 403]]) {
      const response = await fetch(`${base}/api/fixture/mutate`, { method: "POST", headers: { Cookie: cookie, Origin: value } });
      assert.equal(response.status, expected);
    }
  });
  await check("upstream redirect and Set-Cookie stay intact", async () => {
    const response = await fetch(`${base}/api/fixture/redirect`, { redirect: "manual" });
    assert.equal(response.status, 307); assert.equal(response.headers.get("location"), "/api/fixture/destination");
    assert.equal(response.headers.getSetCookie().length, 1);
  });
  await check("SSR nonce matches every inline script and differs per request", async () => {
    let previous;
    for (let index = 0; index < 2; index++) {
      const response = await fetch(`${base}/login`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
      const csp = response.headers.get("content-security-policy");
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
      assert.ok(nonce); assert.notEqual(nonce, previous); previous = nonce;
      const html = await response.text();
      const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
      assert.ok(scripts.length > 1);
      for (const [, attributes] of scripts) assert.ok(attributes.includes(`nonce="${nonce}"`), "script missing matching CSP nonce");
      assert.ok(html.includes("Ekavyu"));
    }
  });
  await check("auth redirects and cookie deletion via proxy.ts", async () => {
    let response = await fetch(`${base}/dashboard`, { redirect: "manual" });
    assert.equal(response.status, 307); assert.ok(response.headers.get("location").endsWith("/login"));
    response = await fetch(`${base}/login`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(response.status, 307); assert.ok(response.headers.get("location").endsWith("/dashboard"));
    response = await fetch(`${base}/browse?logout=1`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(response.status, 307); assert.equal(response.headers.getSetCookie().length, 3);
  });
  await check("dynamic SSR profile and upstream 404", async () => {
    let response = await fetch(`${base}/doctor/synthetic-doctor`);
    assert.equal(response.status, 200); assert.ok((await response.text()).includes("Synthetic SSR fixture"));
    response = await fetch(`${base}/doctor/missing`); assert.equal(response.status, 404);
  });
  await check("PWA headers and hashed assets", async () => {
    for (const [route, policy] of [["/sw.js", "no-store"], ["/manifest.json", "must-revalidate"]]) {
      const response = await fetch(base + route); assert.equal(response.status, 200); assert.ok(response.headers.get("cache-control").includes(policy));
    }
    const html = await (await fetch(`${base}/login`)).text();
    const src = /src="([^\"]*\/_next\/static\/[^\"]+)"/.exec(html)?.[1]; assert.ok(src);
    assert.equal((await fetch(new URL(src, base))).status, 200);
  });
  for (const route of ["/api/ws", "/api/notifications/ws", "/api/clinical/ws?locationId=000000000000000000000001", "/api/queue/ws?locationId=000000000000000000000001"]) {
    await check(`native authenticated upgrade, text/binary and close: ${route}`, () => socketCheck(route, { protocol: "ekavyu.fixture" }));
  }
  await check("bearer header authentication", () => socketCheck("/api/ws", { credential: "", authorization: `Bearer ${good}` }));
  await check("public queue stays public", () => socketCheck("/api/queue/ws?locationId=000000000000000000000001", { credential: "" }));
  await check("missing cookie denied by upstream", () => socketCheck("/api/ws", { credential: "", code: 1008 }));
  await check("bad Origin denied by upstream", () => socketCheck("/api/ws", { suppliedOrigin: "https://evil.invalid", code: 1008 }));
  await check("invalid token denied by upstream", () => socketCheck("/api/ws", { credential: "access_token=invalid", code: 1008 }));
  await check("expired token denied by upstream", () => socketCheck("/api/ws", { credential: `access_token=${sign({ exp: 0 })}`, code: 1008 }));
  await check("tenant rejection reaches client", () => socketCheck("/api/clinical/ws", { credential: `access_token=${sign({ tenant: "other", exp: Date.now() + 60_000 })}`, code: 4003 }));
  await check("backend revocation close reaches client", () => socketCheck("/api/ws", { code: 4001 }));
  await check("HTTP handshake rejection and deletion cookie", () => rejectedHandshake("/api/ws?rejectHandshake=1", 401));
  await check("unknown upgrade path cannot become an open proxy", async () => {
    const count = requests.length;
    await rejectedHandshake("/api/not-a-socket?url=https://evil.invalid", 404);
    assert.equal(requests.length, count);
  });
  await check("upgrade metadata and client close reach upstream", async () => {
    assert.ok(requests.some(req => req.headers.upgrade === "websocket" && req.headers.origin === origin && req.headers.cookie === cookie && req.headers["sec-websocket-protocol"] === "ekavyu.fixture"));
    assert.ok(closes.some(value => value.code === 1000 && value.reason === "fixture done"));
  });
  await check("Worker artifact and Free bundle/asset size", async () => {
    const directory = ".cloudflare/output/v0/workers/default";
    const config = JSON.parse(await readFile(`${directory}/worker.config.json`, "utf8"));
    assert.equal(config.name, "ekavyu-dev"); assert.equal(config.env.BACKEND_INTERNAL_URL.value, "http://127.0.0.1:5099");
    assert.deepEqual(config.assets.runWorkerFirst, ["/*", "!/_next/static/*", "!/*/_next/static/*"]);
    const entry = await readFile(`${directory}/bundle/index.js`, "utf8"); assert.ok(entry.includes("/api/clinical/ws"));
    async function files(root) { const entries = await readdir(root, { withFileTypes: true }); return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(root, entry.name)) : path.join(root, entry.name)))).flat(); }
    const modules = (await files(`${directory}/bundle`)).filter(file => !file.endsWith(".map") && !file.includes(`${path.sep}.vite${path.sep}`));
    const bundleBytes = (await Promise.all(modules.map(file => stat(file)))).reduce((sum, value) => sum + value.size, 0);
    const assets = await files(`${directory}/assets`); const sizes = await Promise.all(assets.map(file => stat(file)));
    assert.ok(bundleBytes < 64 * 1024 * 1024); assert.ok(assets.length < 20_000); assert.ok(sizes.every(value => value.size < 25 * 1024 * 1024));
    console.log(JSON.stringify({ bundleBytes, moduleCount: modules.length, assetCount: assets.length, maxAssetBytes: Math.max(...sizes.map(value => value.size)) }));
  });
  console.log(`${passed} focused checks passed. Mock upstream only; no live identity/session/database validation.`);
} finally {
  for (const client of wss.clients) client.terminate();
  await new Promise(resolve => wss.close(resolve));
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
