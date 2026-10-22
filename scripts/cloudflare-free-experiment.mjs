// Operator-only, synthetic Workers Free experiment. Never imported by the app.
// Authentication stays in the CLI's existing local OAuth profile, never output or uploaded.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, copyFile, symlink, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { syntheticCookie } from "./cloudflare-cpu-fixture.mjs";
import fixtureWorker from "./cloudflare-cpu-fixture.mjs";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = path.join(root, ".cloudflare/free-experiment");
const statePath = path.join(work, "state.json");
const command = process.argv[2];
await mkdir(work, { recursive: true });
const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const save = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + "\n");
let state = await readJson(statePath).catch(() => null);
const persist = () => save(statePath, state);
const sha = data => createHash("sha256").update(data).digest("hex");
const project = path.join(work, "project");
const fixture = path.join(work, "fixture");
// No public/backend/credential environment inheritance into the isolated build.
function environment() {
  const env = {};
  for (const key of ["PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "TEMP", "TMP", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOME", "ComSpec", "NUMBER_OF_PROCESSORS"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, NODE_ENV: "production", CI: "1", NO_COLOR: "1", CLOUDFLARE_ACCOUNT_ID: state.accountId,
    NEXT_TELEMETRY_DISABLED: "1", CLOUDFLARE_SEND_METRICS: "false",
    NEXT_PUBLIC_API_URL: `${state.origin}/api`, NEXT_PUBLIC_WS_URL: state.origin.replace("https:", "wss:"),
    APP_URL: state.origin, BACKEND_INTERNAL_URL: state.fixtureOrigin };
}
async function run(executable, args, cwd, label) {
  const log = path.join(work, `${label}.log`);
  let output = "";
  const child = spawn(executable, args, { cwd, env: environment(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const heartbeat = setInterval(() => {
    console.log(JSON.stringify({ label, running: true, capturedBytes: output.length }));
  }, 30000);
  const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  clearInterval(heartbeat);
  await writeFile(log, output);
  // Keep raw CLI diagnostics local; never print authentication diagnostics.
  console.log(JSON.stringify({ label, exitCode, log: path.relative(root, log) }));
  assert.equal(exitCode, 0, `${label} failed; inspect its local log`);
  return output;
}
const cf = path.join(root, "node_modules/cf/bin/cf");
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(location));
    else result.push(location);
  }
  return result;
}
async function verify() {
  for (const [directory, name, app] of [[project, state.name, true], [fixture, state.fixtureName, false]]) {
    const artifactRoot = path.join(directory, ".cloudflare/output/v0/workers/default");
    const config = await readJson(path.join(artifactRoot, "worker.config.json"));
    assert.equal(config.name, name);
    for (const key of ["domains", "routes", "triggers", "tailConsumers"]) assert.ok(!config[key]?.length, key);
    assert.equal(config.workersDev, true);
    assert.equal(config.previewUrls, false);
    assert.equal(config.cache?.enabled, false);
    const permitted = app ? ["ASSETS", "BACKEND_INTERNAL_URL", "APP_URL"] : ["APP_URL"];
    assert.deepEqual(Object.keys(config.env).sort(), permitted.sort());
    for (const binding of Object.values(config.env)) assert.ok(["text", "assets"].includes(binding.type));
    assert.equal(config.env.APP_URL.value, state.origin);
    if (app) assert.equal(config.env.BACKEND_INTERNAL_URL.value, state.fixtureOrigin);
    const bundle = await files(path.join(artifactRoot, "bundle"));
    const hashes = {};
    let bytes = 0;
    for (const file of bundle) {
      const data = await readFile(file);
      hashes[path.relative(artifactRoot, file)] = sha(data);
      if (!file.endsWith(".map")) {
        bytes += data.length;
        assert.ok(!/(?:https?|wss?):\/\/[^\s"'<>\\]*(?:onrender\.com|vercel\.app|ekavyu\.com)/i.test(data.toString()), "Live origin found in built code");
        assert.ok(!/mongodb(?:\+srv)?:\/\//i.test(data.toString()), "Database URL found in build");
      }
    }
    assert.ok(bytes < 64 * 1024 * 1024, "Free uncompressed bundle limit");
    if (app) {
      const assets = await files(path.join(artifactRoot, "assets"));
      assert.ok(assets.length <= 20000);
      for (const file of assets) {
        const data = await readFile(file);
        assert.ok(data.length <= 25 * 1024 * 1024);
        if (/\.(?:js|json|html)$/.test(file)) assert.ok(!/(?:https?|wss?):\/\/[^\s"'<>\\]*(?:onrender\.com|vercel\.app|ekavyu\.com)/i.test(data.toString()), "Live browser origin");
        hashes[path.relative(artifactRoot, file)] = sha(data);
      }
    }
    hashes["worker.config.json"] = sha(await readFile(path.join(artifactRoot, "worker.config.json")));
    const digest = sha(JSON.stringify(hashes));
    if (state.reviewed?.[name]) assert.equal(digest, state.reviewed[name].digest, "Reviewed artifact changed");
    else { state.reviewed ||= {}; state.reviewed[name] = { digest, bundleBytes: bytes, files: Object.keys(hashes).length }; }
  }
  await persist();
  console.log(JSON.stringify({ reviewed: state.reviewed }, null, 2));
}

async function api(endpoint, body) {
  // No token is accepted in arguments, shell command text, logs, build env or fixtures.
  const auth = await readJson(path.join(process.env.APPDATA, "xdg.config/cloudflare/config/default.json"));
  assert.ok(auth.oauth_token && Date.parse(auth.expiration_time) > Date.now(), "CLI login expired; run cf auth login");
  const localBefore = Date.now();
  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${auth.oauth_token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  result._clock = { localBefore, localAfter: Date.now(), serverDate: response.headers.get("date") };
  if (!response.ok || result.success === false || result.errors?.length) {
    throw new Error(`Cloudflare ${response.status}: ${JSON.stringify(result.errors || result)}`);
  }
  return result;
}

async function metricsFor(name, start, end) {
  const query = `query($account: string, $name: string, $start: string, $end: string) {
    viewer { accounts(filter:{accountTag:$account}) {
      workersInvocationsAdaptive(limit:100, filter:{scriptName:$name,datetime_geq:$start,datetime_leq:$end}) {
        dimensions { status }
        sum { requests errors subrequests }
        avg { sampleInterval }
        quantiles { cpuTimeP50 cpuTimeP95 cpuTimeP99 wallTimeP50 wallTimeP99 memoryUsageBytesP50 memoryUsageBytesP99 }
      }
    }}
  }`;
  return api("/graphql", { query, variables: { account: state.accountId, name, start, end } });
}
async function controlledRequest(label, route, { cookie = false, expected = 200, method = "GET", origin, marker, fixtureTarget = false } = {}) {
  assert.ok(state.appDeployed && !state.cleaned, "Staging must be deployed and not cleaned up");
  assert.ok(!state.trafficStopped, "Traffic was stopped; inspect evidence before any further requests");
  assert.ok(state.requestCount < 240, "Conservative frontend request ceiling reached");
  // Increment and persist before sending: interrupted requests still consume the budget.
  state.requestCount++;
  await persist();
  const started = new Date().toISOString(), clock = performance.now();
  const headers = {};
  if (cookie) headers.Cookie = syntheticCookie;
  if (origin) headers.Origin = origin;
  let record;
  try {
    const response = await fetch(`${fixtureTarget ? state.fixtureOrigin : state.origin}${route}`, { method, headers, redirect: "manual", signal: AbortSignal.timeout(30000) });
    const body = await response.text();
    const csp = response.headers.get("Content-Security-Policy");
    record = { label, route, fixtureTarget, started, ended: new Date().toISOString(), status: response.status,
      clientWallMs: performance.now() - clock, responseBytes: Buffer.byteLength(body),
      cfRay: response.headers.get("cf-ray"),
      fixtureMarker: response.headers.get("x-ekavyu-fixture"),
      resourceError: response.status >= 500 && /\b(?:1102|1027)\b|exceeded.*(?:CPU|resource)/i.test(body),
      noncePresent: csp?.includes("'nonce-") || false };
    state.requests ||= [];
    state.requests.push(record);
    await persist();
    assert.ok(!record.resourceError, "Platform resource-exceeded error: stop traffic");
    if (expected !== null) assert.equal(response.status, expected, `Unexpected status for ${label}`);
    const location = response.headers.get("Location");
    if (location) assert.equal(new URL(location, state.origin).origin, state.origin, "External redirect");
    if (marker) assert.ok(body.includes(marker), `Missing SSR content for ${label}`);
    if (response.headers.get("Content-Type")?.includes("text/html") && expected === 200) {
      const nonce = csp?.match(/'nonce-([^']+)'/)?.[1];
      assert.ok(nonce, `${label}: missing CSP nonce`);
      state.nonces ||= [];
      assert.ok(!state.nonces.includes(nonce), "CSP nonce reused");
      state.nonces.push(nonce);
      for (const tag of body.matchAll(/<script\b[^>]*>/g)) assert.ok(tag[0].includes(`nonce="${nonce}"`), `${label}: script nonce mismatch`);
    }
    return { response, body, record };
  } catch (error) {
    if (!record) {
      state.requests ||= [];
      state.requests.push({ label, route, started, ended: new Date().toISOString(), transportError: error.message });
    }
    state.trafficStopped = error.message;
    await persist();
    throw error;
  }
}

if (command === "preflight") {
  assert.ok(!state, "An experiment already exists; inspect state.json before starting another");
  const accounts = (await api("/accounts")).result;
  assert.equal(accounts.length, 1, "Select the intended account explicitly when more than one exists");
  const accountId = accounts[0].id;
  const subscriptions = (await api(`/accounts/${accountId}/subscriptions`)).result;
  assert.equal(subscriptions.length, 0, "Stop: subscriptions need manual Free-plan review");
  const subdomain = (await api(`/accounts/${accountId}/workers/subdomain`)).result.subdomain;
  assert.match(subdomain, /^[a-z0-9-]+$/);
  const accountSettings = (await api(`/accounts/${accountId}/workers/account-settings`)).result;
  const existing = (await api(`/accounts/${accountId}/workers/scripts`)).result;
  const suffix = new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomBytes(3).toString("hex");
  const name = `ekavyu-cpu-${suffix}`;
  const fixtureName = `${name}-fixture`;
  assert.ok(!existing.some(item => [name, fixtureName].includes(item.id)));
  state = {
    accountId, subdomain, name, fixtureName, created: new Date().toISOString(),
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    origin: `https://${name}.${subdomain}.workers.dev`,
    fixtureOrigin: `https://${fixtureName}.${subdomain}.workers.dev`,
    requestCount: 0, maxRequests: 500, subscriptions, accountSettings,
    existingWorkerNames: existing.map(item => item.id),
  };
  await persist();
  console.log(JSON.stringify({ freeSubscriptions: subscriptions, accountSettings, existingWorkers: existing.length, origin: state.origin, fixtureOrigin: state.fixtureOrigin }, null, 2));
} else {
  assert.ok(state, "Run preflight first");
  assert.match(state.name, /^ekavyu-cpu-\d{8}-[a-f0-9]{6}$/);
  assert.equal(state.fixtureName, `${state.name}-fixture`);
  if (command === "prepare") {
    assert.ok(!state.prepared, "Snapshot already prepared");
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
    const sourceHashes = {};
    for (const file of tracked) {
      if (!/^(?:src\/|public\/|packages\/|cloudflare\/|scripts\/check-production-api-url\.mjs$|(?:next|vite|postcss|cloudflare)\.config\.|tsconfig.*\.json$|package(?:-lock)?\.json$)/.test(file)) continue;
      if (file.startsWith("src/tests/")) continue;
      assert.ok(!/(?:^|\/)\.env|\.pem$/i.test(file));
      const source = path.join(root, file), destination = path.join(project, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
      sourceHashes[file] = sha(await readFile(source));
    }
    await mkdir(fixture, { recursive: true });
    for (const directory of [project, fixture]) {
      const modules = path.join(directory, "node_modules");
      const resolved = await realpath(modules).catch(() => null);
      if (resolved) assert.equal(resolved, await realpath(path.join(root, "node_modules")));
      else await symlink(path.join(root, "node_modules"), modules, "junction");
    }
    await copyFile(path.join(root, "scripts/cloudflare-cpu-fixture.mjs"), path.join(fixture, "worker.mjs"));
    await save(path.join(fixture, "package.json"), { type: "module", scripts: { build: "vite build" }, devDependencies: { "@cloudflare/vite-plugin": "2.0.0-beta.v.1", vite: "8.3.5" } });
    await writeFile(path.join(fixture, "vite.config.ts"), 'import { defineConfig } from "vite";\nimport { cloudflare } from "@cloudflare/vite-plugin";\nexport default defineConfig({plugins:[cloudflare()]});\n');
    const settings = `workersDev: true, previewUrls: false, cache: { enabled: false }, observability: { enabled: false },`;
    await writeFile(path.join(fixture, "cloudflare.config.ts"), `import { defineConfig, defineWorker, bindings } from "cf/config";\nexport default defineConfig({accountId:${JSON.stringify(state.accountId)},worker:defineWorker({name:${JSON.stringify(state.fixtureName)},entrypoint:"./worker.mjs",compatibilityDate:"2026-10-18",${settings}env:{APP_URL:bindings.text(${JSON.stringify(state.origin)})}})});\n`);
    const original = await readFile(path.join(project, "cloudflare.config.ts"), "utf8");
    const configured = original.replace('name: "ekavyu-dev",', `name: ${JSON.stringify(state.name)},\n    ${settings}`)
      .replace('entrypoint: "./cloudflare/worker.ts",', 'entrypoint: "./cloudflare/staging-worker.ts",')
      .replace("ASSETS: bindings.assets(),", `ASSETS: bindings.assets(),\n      APP_URL: bindings.text(${JSON.stringify(state.origin)}),`);
    assert.notEqual(original, configured);
    await writeFile(path.join(project, "cloudflare.config.ts"), configured);
    await writeFile(path.join(project, "cloudflare/staging-worker.ts"), `// Staging-only egress guard; reviewed application handler remains unchanged.\nimport worker from "./worker";\nexport * from "./worker";\nconst nativeFetch = globalThis.fetch;\nconst allowed = ${JSON.stringify(state.fixtureOrigin)};\nglobalThis.fetch = (input, init) => {\n const url = new URL(input instanceof Request ? input.url : String(input));\n if(url.origin !== allowed) throw new Error("Synthetic staging: outbound origin denied");\n return nativeFetch(input, init);\n};\nexport default { ...worker, async fetch(request, env, ctx) {\n if(new URL(request.url).origin !== ${JSON.stringify(state.origin)}) return new Response("Staging origin denied",{status:421});\n const response = await worker.fetch(request,env,ctx);\n const destination = response.headers.get("Location");\n if(destination && new URL(destination,request.url).origin !== ${JSON.stringify(state.origin)}) return new Response("External redirect denied",{status:502});\n return response;\n}};\n`);
    state.prepared = true;
    state.sourceHashes = sourceHashes;
    await persist();
    console.log(JSON.stringify({ prepared: true, sourceFiles: Object.keys(sourceHashes).length, project: path.relative(root, project), noEnvFilesCopied: true }));
  } else if (command === "build-fixture") {
    await save(path.join(fixture, "package.json"), { type: "module", scripts: { build: "vite build" }, devDependencies: { "@cloudflare/vite-plugin": "2.0.0-beta.v.1", vite: "8.3.5" } });
    await writeFile(path.join(fixture, "vite.config.ts"), 'import { defineConfig } from "vite";\nimport { cloudflare } from "@cloudflare/vite-plugin";\nexport default defineConfig({plugins:[cloudflare()]});\n');
    await run(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "build"], fixture, "fixture-build");
    await verify();
  } else if (command === "build") {
    assert.ok(state.prepared);
    await run(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "build"], project, "app-build");
    await run(process.execPath, [cf, "build"], fixture, "fixture-build");
    await verify();
  } else if (command === "verify") {
    await verify();
  } else if (command === "check-local") {
    const source = await readFile(path.join(project, "cloudflare/staging-worker.ts"), "utf8");
    const mockedSource = source.replace(/^import worker.*;$/m, "").replace(/^export \*.*;$/m, "")
      .replace("export default", "globalThis.handler =");
    let calls = 0;
    const sandbox = { URL, Request, Response, Error,
      fetch: async () => { calls++; return new Response("synthetic"); },
      worker: { async fetch(request) { return new Response("ok", { headers: request.headers.get("X-Fixture-Redirect") ? { Location: request.headers.get("X-Fixture-Redirect") } : {} }); } },
    };
    vm.runInNewContext(mockedSource, sandbox);
    await sandbox.fetch(`${state.fixtureOrigin}/api/auth/me`);
    assert.equal(calls, 1);
    for (const denied of ["https://outside.invalid/api", "https://dev.ekavyu.com/api", "https://fixture.invalid@outside.invalid/", `${state.fixtureOrigin}.outside.invalid/`]) {
      assert.throws(() => sandbox.fetch(denied), /denied/);
    }
    assert.equal(calls, 1, "Denied URLs must never issue network requests");
    assert.equal((await sandbox.handler.fetch(new Request("https://outside.invalid/"))).status, 421);
    assert.equal((await sandbox.handler.fetch(new Request(state.origin, { headers: { "X-Fixture-Redirect": "https://outside.invalid/" } }))).status, 502);
    assert.equal((await sandbox.handler.fetch(new Request(state.origin, { headers: { "X-Fixture-Redirect": "/login" } }))).status, 200);
    const nativeUpgrade = { headers: new Headers(), webSocket: { syntheticNativeSocket: true }, status: 101 };
    sandbox.worker.fetch = async () => nativeUpgrade;
    assert.equal(await sandbox.handler.fetch(new Request(state.origin)), nativeUpgrade, "Preserve native upgrade response identity");
    const cookieResponse = new Response("ok", { headers: { "Set-Cookie": "synthetic=1; Path=/; Secure; HttpOnly" } });
    sandbox.worker.fetch = async () => cookieResponse;
    assert.equal(await sandbox.handler.fetch(new Request(state.origin)), cookieResponse, "Preserve HTTP/Set-Cookie response identity");
    const fixtureEnv = { APP_URL: state.origin };
    const req = (route, headers = {}, method = "GET") => new Request(`${state.fixtureOrigin}${route}`, { headers, method });
    assert.equal((await fixtureWorker.fetch(req("/api/auth/me"), fixtureEnv)).status, 401);
    assert.equal((await fixtureWorker.fetch(req("/api/auth/me", { Cookie: syntheticCookie }), fixtureEnv)).status, 200);
    assert.equal((await fixtureWorker.fetch(req("/api/auth/me", { Cookie: syntheticCookie, Origin: "https://hostile.invalid" }), fixtureEnv)).status, 403);
    assert.equal((await fixtureWorker.fetch(req("/api/fixture/security", { Cookie: syntheticCookie }, "POST"), fixtureEnv)).status, 403);
    const cookies = await fixtureWorker.fetch(req("/api/fixture/security", { Cookie: syntheticCookie, Origin: state.origin }, "POST"), fixtureEnv);
    assert.equal(cookies.headers.getSetCookie().length, 3);
    assert.equal((await fixtureWorker.fetch(req("/unknown"), fixtureEnv)).status, 404);
    console.log(JSON.stringify({ stagingIsolationAndFixtureChecks: "PASS", networkUsed: false }));
  } else if (command === "clock") {
    const result = await api(`/accounts/${state.accountId}/workers/subdomain`);
    await save(path.join(work, "platform-clock.json"), result._clock);
    console.log(JSON.stringify(result._clock));
  } else if (command === "metrics-check") {
    const query = '{ __type(name:"AccountWorkersInvocationsAdaptiveQuantiles") { fields { name description } } }';
    const schema = await api("/graphql", { query });
    await save(path.join(work, "metrics-schema.json"), schema);
    const result = await metricsFor(state.name, new Date(Date.now() - 3600000).toISOString(), new Date().toISOString());
    await save(path.join(work, "metrics-check.json"), result);
    state.metricsAvailable = true;
    await persist();
    console.log(JSON.stringify({ metricsAvailable: true, schema: schema.data, result }, null, 2));
  } else if (["deploy-fixture", "deploy-app"].includes(command)) {
    await verify();
    assert.ok(!state.cleaned, "Experiment already cleaned up");
    assert.ok(state.metricsAvailable, "Verify metrics access before deploying");
    const isApp = command === "deploy-app", name = isApp ? state.name : state.fixtureName;
    if (isApp) assert.ok(state.fixtureDeployed, "Deploy fixture first");
    assert.equal((await api(`/accounts/${state.accountId}/subscriptions`)).result.length, 0, "Free eligibility changed");
    state.owned ||= [];
    assert.ok(!state.owned.includes(name), "Deployment already attempted; inspect before retrying");
    state.owned.push(name);
    await persist();
    await run(process.execPath, [cf, "deploy", "--prebuilt", "--no-provision"], isApp ? project : fixture, command);
    state[isApp ? "appDeployed" : "fixtureDeployed"] = true;
    await persist();
  } else if (command === "measure") {
    assert.ok(!state.measurementStarted, "Traffic already started; do not repeat implicitly");
    state.measurementStarted = new Date().toISOString();
    state.windows = [];
    await persist();
    const routes = [
      { label: "login", route: "/login", marker: "<html" },
      { label: "public-home", route: "/", marker: "<html" },
      { label: "public-doctor", route: "/doctor/synthetic-doctor", marker: "Synthetic SSR fixture" },
      { label: "public-doctor-large", route: "/doctor/synthetic-large", marker: "Synthetic public profile." },
      { label: "dashboard-shell", route: "/dashboard", cookie: true, marker: "<html" },
      { label: "appointments-shell", route: "/dashboard/appointments", cookie: true, marker: "<html" },
      { label: "dashboard-redirect", route: "/dashboard", expected: 307 },
      { label: "authenticated-api", route: "/api/auth/me", cookie: true, marker: '"synthetic"' },
      { label: "unauthorized-api", route: "/api/auth/me", expected: 401 },
      { label: "delayed-api", route: "/api/auth/me?delay=150", cookie: true },
    ];
    const first = { label: "first-observed-login", route: "/login", start: new Date().toISOString(), requestStart: state.requestCount };
    state.windows.push(first);
    await controlledRequest(first.label, first.route, { marker: "<html" });
    first.end = new Date().toISOString();
    first.requests = 1;
    await persist();
    for (const route of routes) {
      // Distinct whole-second time windows permit per-route GraphQL aggregation.
      await new Promise(resolve => setTimeout(resolve, 2100));
      const window = { label: route.label, route: route.route, start: new Date().toISOString(), requestStart: state.requestCount };
      state.windows.push(window);
      await persist();
      for (let index = 0; index < 12; index++) await controlledRequest(route.label, route.route, route);
      window.end = new Date().toISOString();
      window.requests = state.requestCount - window.requestStart;
      await persist();
      console.log(JSON.stringify(window));
    }
    state.measurementEnded = new Date().toISOString();
    await persist();
    console.log(JSON.stringify({ frontendRequests: state.requestCount, message: "Client wall times are latency, NOT CPU milliseconds" }));
  } else if (command === "diagnose-fixture") {
    assert.ok(!state.requests.some(item => item.resourceError), "Resource limit observed; do not send more traffic");
    assert.ok(!state.diagnosed, "Diagnostics already attempted");
    state.diagnosed = true;
    state.stops ||= [];
    state.stops.push(state.trafficStopped);
    delete state.trafficStopped;
    await persist();
    for (const [label, route, expected, fixtureTarget] of [
      ["fixture-doctor-direct", "/api/public/doctors/synthetic-doctor/profile", 200, true],
      ["fixture-doctor-forwarded", "/api/public/doctors/synthetic-doctor/profile", 200, false],
      ["fixture-auth-forwarded", "/api/auth/me", 401, false],
    ]) {
      const { response, body } = await controlledRequest(label, route, { expected, fixtureTarget });
      console.log(JSON.stringify({ label, status: response.status, fixtureHeader: response.headers.get("x-ekavyu-fixture"), body: body.slice(0, 600) }));
    }
  } else if (command === "measure-ssr-minutes") {
    assert.ok(!state.requests.some(item => item.resourceError));
    assert.ok(!state.minuteMeasurementStarted, "Minute-isolated measurement already started");
    state.minuteMeasurementStarted = new Date().toISOString();
    state.stops.push(state.trafficStopped);
    delete state.trafficStopped;
    await persist();
    for (const entry of [
      { label: "login-minute", route: "/login" },
      { label: "public-home-minute", route: "/" },
      { label: "dashboard-shell-minute", route: "/dashboard", cookie: true },
      { label: "appointments-shell-minute", route: "/dashboard/appointments", cookie: true },
      { label: "dashboard-redirect-minute", route: "/dashboard", expected: 307 },
    ]) {
      // Workers metrics may aggregate timestamps by minute. Do not mix routes in a minute.
      const boundary = Math.floor(Date.now() / 60000) * 60000 + 60000;
      while (Date.now() < boundary + 1000) {
        await new Promise(resolve => setTimeout(resolve, Math.min(15000, boundary + 1000 - Date.now())));
      }
      const window = { label: entry.label, route: entry.route, start: new Date(boundary).toISOString(), requestStart: state.requestCount, granularity: "minute" };
      state.windows.push(window);
      await persist();
      for (let index = 0; index < 6; index++) await controlledRequest(entry.label, entry.route, entry);
      window.end = new Date(boundary + 59999).toISOString();
      window.requests = state.requestCount - window.requestStart;
      await persist();
      console.log(JSON.stringify(window));
    }
    state.minuteMeasurementEnded = new Date().toISOString();
    await persist();
  } else if (command === "diagnose-routing") {
    assert.ok(!state.requests.some(item => item.resourceError));
    assert.ok(!state.routingDiagnosed);
    state.routingDiagnosed = true;
    state.stops.push(state.trafficStopped);
    delete state.trafficStopped;
    await persist();
    for (const route of ["/api/public/doctors/synthetic-doctor/profile", "/api/auth/me"]) {
      const { response, body } = await controlledRequest("routing-diagnostic", route, { expected: null });
      console.log(JSON.stringify({ route, status: response.status, fixtureMarker: response.headers.get("x-ekavyu-fixture"), contentType: response.headers.get("Content-Type"), body: body.slice(0, 600) }));
    }
  } else if (command === "security-smoke") {
    assert.ok(!state.securitySmokeStarted, "Security smoke already started");
    state.securitySmokeStarted = true;
    await persist();
    const { response } = await controlledRequest("cookie-origin", "/api/fixture/security", { method: "POST", cookie: true, origin: state.origin });
    assert.equal(response.headers.getSetCookie().length, 3);
    for (const value of response.headers.getSetCookie()) assert.ok(/Secure/.test(value) && /Path=\//.test(value) && !/Domain=/i.test(value));
    await controlledRequest("hostile-origin", "/api/fixture/security", { method: "POST", cookie: true, origin: "https://hostile.invalid", expected: 403 });
    await controlledRequest("missing-origin", "/api/fixture/security", { method: "POST", cookie: true, expected: 403 });
    await controlledRequest("upstream-redirect", "/api/fixture/redirect", { expected: 307 });
    const sw = await controlledRequest("service-worker", "/sw.js");
    assert.match(sw.response.headers.get("Cache-Control"), /no-store/);
    await controlledRequest("pwa-manifest", "/manifest.json");
    await controlledRequest("logout-cookies", "/login?logout=1");
    state.securitySmokePassed = true;
    await persist();
    console.log(JSON.stringify({ securitySmokePassed: true }));
  } else if (command === "metrics") {
    assert.ok(state.measurementStarted);
    const captured = new Date().toISOString();
    const calibration = (await api(`/accounts/${state.accountId}/workers/subdomain`))._clock;
    const lowerSkew = Date.parse(calibration.serverDate) - calibration.localAfter;
    const upperSkew = Date.parse(calibration.serverDate) + 1000 - calibration.localBefore;
    const shifted = (value, skew) => new Date(Date.parse(value) + skew).toISOString();
    const aggregate = await metricsFor(state.name, shifted(state.measurementStarted, lowerSkew - 1000), shifted(captured, upperSkew + 1000));
    const fixtureMetrics = await metricsFor(state.fixtureName, shifted(state.measurementStarted, lowerSkew - 1000), shifted(captured, upperSkew + 1000));
    const windows = [];
    for (const window of state.windows || []) {
      if (!window.end) continue;
      const requests = state.requests.filter(item => item.label === window.label);
      if (!requests.length) continue;
      const platformStart = shifted(requests[0].started, lowerSkew - 1000);
      const platformEnd = shifted(requests.at(-1).ended, upperSkew + 1000);
      windows.push({ ...window, platformStart, platformEnd, platform: await metricsFor(state.name, platformStart, platformEnd) });
    }
    const result = { captured, calibration, lowerSkew, upperSkew, cpuUnits: "microseconds; divide by 1000 for milliseconds", aggregate, fixtureMetrics, windows };
    await save(path.join(work, `platform-metrics-${Date.now()}.json`), result);
    await save(path.join(work, "platform-metrics-latest.json"), result);
    const summarize = platform => platform.data.viewer.accounts.flatMap(account => account.workersInvocationsAdaptive).map(row => ({
      status: row.dimensions.status, ...row.sum,
      sampleInterval: row.avg?.sampleInterval,
      cpuP50Ms: row.quantiles.cpuTimeP50 / 1000, cpuP95Ms: row.quantiles.cpuTimeP95 / 1000, cpuP99Ms: row.quantiles.cpuTimeP99 / 1000,
      platformWallP50Ms: row.quantiles.wallTimeP50 / 1000, memoryP99Bytes: row.quantiles.memoryUsageBytesP99,
    }));
    console.log(JSON.stringify({ captured, skewSeconds: [lowerSkew / 1000, upperSkew / 1000], aggregate: summarize(aggregate), fixture: summarize(fixtureMetrics),
      windows: windows.map(window => ({ label: window.label, controlledRequests: window.requests, granularity: window.granularity, metrics: summarize(window.platform) })) }, null, 2));
  } else if (command === "inspect-deployed") {
    const results = [];
    for (const name of [state.name, state.fixtureName]) {
      const settings = (await api(`/accounts/${state.accountId}/workers/scripts/${name}/settings`)).result;
      const subdomain = (await api(`/accounts/${state.accountId}/workers/scripts/${name}/subdomain`)).result;
      results.push({ name, settings, subdomain });
    }
    const subscriptions = (await api(`/accounts/${state.accountId}/subscriptions`)).result;
    assert.equal(subscriptions.length, 0);
    await save(path.join(work, "deployed-settings.json"), { results, subscriptions });
    console.log(JSON.stringify({ results, subscriptions }, null, 2));
  } else if (command === "cleanup") {
    // Only resources recorded as newly owned by this experiment can be removed.
    const auth = await readJson(path.join(process.env.APPDATA, "xdg.config/cloudflare/config/default.json"));
    for (const name of [...(state.owned || [])].reverse()) {
      assert.ok([state.name, state.fixtureName].includes(name) && !state.existingWorkerNames.includes(name));
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${state.accountId}/workers/scripts/${name}`, {
        method: "DELETE", redirect: "error", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${auth.oauth_token}` },
      });
      assert.ok(response.ok || response.status === 404, `Cleanup failed for ${name}: ${response.status}`);
      state.deleted ||= [];
      state.deleted.push({ name, status: response.status, at: new Date().toISOString() });
      await persist();
    }
    const remaining = (await api(`/accounts/${state.accountId}/workers/scripts`)).result;
    assert.ok(!remaining.some(item => [state.name, state.fixtureName].includes(item.id)));
    state.cleaned = new Date().toISOString();
    await persist();
    console.log(JSON.stringify({ cleaned: state.cleaned, deleted: state.deleted, remainingWorkers: remaining.length }));
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}
