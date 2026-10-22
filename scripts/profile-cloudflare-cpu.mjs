// Profiles the already-built Worker through its local workerd DevTools endpoint.
// No deployment, remote backend, database or real credentials. Raw profiles stay
// under gitignored .cloudflare/cpu and can be loaded into DevTools' Profiler.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { once } from "node:events";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.resolve("vite"));
const { WebSocket } = require("ws");
const { TraceMap, originalPositionFor } = require("@jridgewell/trace-mapping");
const label = process.argv[2] || "before";
assert.match(label, /^[a-z0-9-]+$/);
const output = path.resolve(".cloudflare/cpu", label);
const analyzeOnly = process.argv.includes("--analyze");
await mkdir(output, { recursive: true });
const artifact = JSON.parse(await readFile(".cloudflare/output/v0/workers/default/worker.config.json", "utf8"));
assert.equal(artifact.env.BACKEND_INTERNAL_URL.value, "http://127.0.0.1:5099", "Only the loopback fixture artifact may be profiled");
const cookie = "access_token=synthetic-profile; refresh_token=synthetic-profile; ekavyu_session=1";
let delay = 0;
let upstreamRequests = 0;
const fixture = createServer(async (request, response) => {
  upstreamRequests++;
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/api/auth/me") {
    if (request.headers.cookie !== cookie) { response.statusCode = 401; response.end('{"success":false}'); return; }
    response.end(JSON.stringify({ success: true, data: { id: "synthetic", role: "doctor", organization_id: "synthetic" } }));
    return;
  }
  if (request.url.startsWith("/api/public/doctors/synthetic-doctor/profile")) {
    response.end(JSON.stringify({ data: { id: "synthetic", slug: "synthetic-doctor", name: "Synthetic Doctor", specialization: "General Medicine", qualification: "Fixture", experienceYears: 1, description: "Synthetic SSR fixture", imageUrl: null, languages: ["English"], organizationName: "Fixture Clinic", organizationLogo: null, currency: "INR", locations: [] } }));
    return;
  }
  response.end('{"success":true,"data":[]}');
});

const routes = [
  { name: "login", route: "/login" },
  { name: "public-home", route: "/" },
  { name: "public-doctor", route: "/doctor/synthetic-doctor" },
  { name: "dashboard-shell", route: "/dashboard", cookie },
  { name: "appointments-shell", route: "/dashboard/appointments", cookie },
  { name: "dashboard-redirect", route: "/dashboard", status: 307 },
  { name: "authenticated-api", route: "/api/auth/me", cookie },
  { name: "unauthorized-api", route: "/api/auth/me", status: 401 },
];
const maps = new Map();
async function location(frame) {
  let filename;
  try {
    filename = frame.url.startsWith("file:") ? fileURLToPath(frame.url) : frame.url;
    if (!path.isAbsolute(filename)) {
      if (!filename.endsWith(".js") || filename.includes(":")) return { source: frame.url, name: frame.functionName };
      filename = path.resolve(".cloudflare/output/v0/workers/default/bundle", filename);
    }
    if (!maps.has(filename)) {
      try { maps.set(filename, new TraceMap(JSON.parse(await readFile(`${filename}.map`, "utf8")))); }
      catch { maps.set(filename, null); }
    }
    const map = maps.get(filename);
    if (map && frame.lineNumber >= 0) {
      const original = originalPositionFor(map, { line: frame.lineNumber + 1, column: frame.columnNumber });
      if (original.source) return { source: original.source, name: original.name || frame.functionName, line: original.line };
    }
    // Some dependency frames lack mappings. Identify their bundle only when its
    // source manifest consists entirely of dependencies; do not guess a function.
    if (map?.sources.length && map.sources.every(source => source.includes("node_modules"))) {
      return { source: `framework-bundle:${filename}`, name: frame.functionName };
    }
  } catch { /* Keep the original frame if unmapped. */ }
  return { source: filename || frame.url, name: frame.functionName };
}
function category(source, name) {
  if (name === "(idle)") return "idle";
  if (name === "(program)" || name === "(root)") return "program-unattributed";
  if (name === "(garbage collector)") return "garbage-collection";
  if (source.startsWith("framework-bundle:")) return "framework-bundle-unmapped";
  if (/node_modules.*(?:react-dom|react-server-dom|\/react\/|\\react\\)/.test(source)) return "react";
  if (/vinext/.test(source)) return "vinext";
  if (/node_modules/.test(source)) return "other-dependency";
  if (/\/src\/|\\src\\|\/cloudflare\/|\\cloudflare\\/.test(source)) return "application";
  return "runtime-unmapped";
}
async function summarize(profile) {
  const nodes = new Map();
  for (const node of profile.nodes) nodes.set(node.id, await location(node.callFrame));
  const buckets = {}, hot = {};
  let active = 0, activeSamples = 0;
  // timeDeltas span gaps when the isolate is not executing, including network
  // waits. They are NOT CPU time. Use equal-weight tick counts for attribution;
  // retain raw durations only to expose this limitation, never to bill/validate CPU.
  for (let index = 0; index < (profile.samples || []).length; index++) {
    const node = nodes.get(profile.samples[index]);
    const group = category(node.source || "", node.name);
    const ms = profile.timeDeltas[index] / 1000;
    buckets[group] = (buckets[group] || 0) + ms;
    if (group !== "idle" && group !== "program-unattributed") {
      active += ms;
      activeSamples++;
      const key = `${node.source}:${node.line || ""} ${node.name}`;
      hot[key] = (hot[key] || 0) + 1;
    }
  }
  const selfSamples = {};
  for (const id of profile.samples || []) {
    const node = nodes.get(id);
    const group = category(node.source || "", node.name);
    selfSamples[group] = (selfSamples[group] || 0) + 1;
  }
  return { apparentDurationMs: active, activeSamples, selfSamples, buckets, hot };
}

let ws;
const pending = new Map();
let sequence = 0;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve: result => { clearTimeout(timeout); resolve(result); }, reject: error => { clearTimeout(timeout); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function request(route) {
  const start = performance.now();
  const response = await fetch(`http://127.0.0.1:8787${route.route}`, {
    redirect: "manual", headers: route.cookie ? { Cookie: route.cookie } : {},
  });
  assert.equal(response.status, route.status || 200, route.name);
  const body = await response.text();
  if (route.name === "public-doctor") assert.ok(body.includes("Synthetic SSR fixture"));
  if (route.name === "login") assert.ok(response.headers.get("content-security-policy")?.includes("'nonce-"));
  return performance.now() - start;
}

if (!analyzeOnly) await new Promise(resolve => fixture.listen(5099, "127.0.0.1", resolve));
try {
  let heapBefore;
  if (!analyzeOnly) {
  const targets = await (await fetch("http://127.0.0.1:9229/json/list")).json();
  const target = targets.find(item => item.title.includes("Worker"));
  assert.ok(target);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.on("message", message => {
    const event = JSON.parse(message.toString());
    const item = pending.get(event.id);
    if (item) {
      pending.delete(event.id);
      if (event.error) item.reject(event.error);
      else item.resolve(event.result);
    }
  });
  await once(ws, "open");
  await send("Profiler.enable");
  await send("Profiler.setSamplingInterval", { interval: 100 });
  heapBefore = await send("Runtime.getHeapUsage");
  // Warm shared modules/JIT identically before each measured pass. These cookies
  // exercise the protected SSR shells, not a hydrated browser or real login.
  for (let round = 0; round < 3; round++) for (const route of routes) await request(route);
  for (let round = 0; round < 10; round++) {
    for (const route of routes) {
      await send("Profiler.start");
      const wallMs = await request(route);
      const { profile } = await send("Profiler.stop");
      await writeFile(`${output}/${route.name}-${round}.cpuprofile`, JSON.stringify(profile));
      await writeFile(`${output}/${route.name}-${round}.wall.json`, JSON.stringify({ wallMs }));
    }
  }
  // Paired fixture control: add only upstream latency, keeping the request and
  // response identical. This must not be reported as an increase in Worker CPU.
  for (const delayMs of [0, 150]) {
    delay = delayMs;
    for (let index = 0; index < 5; index++) {
      await send("Profiler.start");
      const wallMs = await request(routes.find(route => route.name === "authenticated-api"));
      const { profile } = await send("Profiler.stop");
      await writeFile(`${output}/waiting-${delayMs}-${index}.cpuprofile`, JSON.stringify(profile));
      await writeFile(`${output}/waiting-${delayMs}-${index}.wall.json`, JSON.stringify({ wallMs }));
    }
  }
  }
  const previous = JSON.parse(await readFile(`${output}/report.json`, "utf8").catch(() => "null"));
  const results = Object.fromEntries(routes.map(route => [route.name, []]));
  for (const route of routes) for (let round = 0; round < 10; round++) {
    const profile = JSON.parse(await readFile(`${output}/${route.name}-${round}.cpuprofile`, "utf8"));
    const wall = JSON.parse(await readFile(`${output}/${route.name}-${round}.wall.json`, "utf8").catch(() => JSON.stringify({ wallMs: previous.results[route.name][round].wallMs })));
    results[route.name].push({ ...wall, ...await summarize(profile) });
  }
  const waitingControl = [];
  for (const delayMs of [0, 150]) for (let index = 0; index < 5; index++) {
    try {
      const profile = JSON.parse(await readFile(`${output}/waiting-${delayMs}-${index}.cpuprofile`, "utf8"));
      const wall = JSON.parse(await readFile(`${output}/waiting-${delayMs}-${index}.wall.json`, "utf8"));
      waitingControl.push({ delayMs, ...wall, ...await summarize(profile) });
    } catch { /* Older baseline did not persist latency-control profiles. */ }
  }
  const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1];
  const summary = {};
  for (const [name, values] of Object.entries(results)) {
    const buckets = {}, hot = {}, selfSamples = {};
    for (const value of values) {
      for (const [key, ms] of Object.entries(value.buckets)) buckets[key] = (buckets[key] || 0) + ms;
      for (const [key, ms] of Object.entries(value.hot)) hot[key] = (hot[key] || 0) + ms;
      for (const [key, count] of Object.entries(value.selfSamples)) selfSamples[key] = (selfSamples[key] || 0) + count;
    }
    summary[name] = { medianActiveSamples: quantile(values.map(value => value.activeSamples), .5), p90ActiveSamples: quantile(values.map(value => value.activeSamples), .9), medianApparentDurationMs: quantile(values.map(value => value.apparentDurationMs), .5), medianWallMs: quantile(values.map(value => value.wallMs), .5), selfSamples, bucketsMeanMs: Object.fromEntries(Object.entries(buckets).map(([key, ms]) => [key, ms / values.length])), hot: Object.entries(hot).sort((a, b) => b[1] - a[1]).slice(0, 12) };
  }
  const entrySha256 = createHash("sha256").update(await readFile(".cloudflare/output/v0/workers/default/bundle/index.js")).digest("hex");
  const report = { label, samplesPerRoute: 10, sampleIntervalUs: 100, node: process.version, entrySha256, heapBefore: heapBefore || previous?.heapBefore, heapAfter: analyzeOnly ? previous?.heapAfter : await send("Runtime.getHeapUsage"), upstreamRequests: analyzeOnly ? previous?.upstreamRequests : upstreamRequests, summary, waitingControl: waitingControl.length ? waitingControl : previous?.waitingControl, results };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ label, summary, waitingControl: report.waitingControl.map(value => ({ delayMs: value.delayMs, wallMs: value.wallMs, activeSamples: value.activeSamples, apparentDurationMs: value.apparentDurationMs })) }, null, 2));
} finally {
  ws?.close();
  fixture.closeAllConnections();
  if (!analyzeOnly) await new Promise(resolve => fixture.close(resolve));
}
