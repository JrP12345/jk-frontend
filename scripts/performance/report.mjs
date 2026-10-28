// Generate a reviewable checkpoint from saved audits; never treat missing rows as passes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { routes } from './fixtures.mjs';

const stage = process.env.AUDIT_STAGE || 'complete';
if (!/^[a-z0-9-]+$/i.test(stage)) throw new Error('Invalid audit stage');
const inventory = JSON.parse(execFileSync(process.execPath, ['scripts/list-performance-routes.mjs'], { encoding: 'utf8' }));
const output = 'docs/performance/lighthouse-remaining-2026-10-23';
const evidence = [];
const replacedAttempts = [], interactions = [], repeated = [], baselineRepeated = [], accessibility = [], accessibilityInitial = [];
const publicFollowup = [], publicAccessibility = [], publicInteractions = [];
for (const profile of ['mobile', 'desktop']) {
  const folder = `ekavyu-remaining-${stage}-${profile}-lighthouse`;
  const rows = JSON.parse(await fs.readFile(path.join(process.env.TEMP, folder, 'summary.json'), 'utf8'));
  for (const row of rows) {
    evidence.push({
      route: row.route, path: row.path, role: row.role || 'anonymous', profile,
      run: row.run, cold: row.cold, status: row.status, reason: row.reason,
      scores: row.scores, metrics: row.metrics, network: row.network,
      unknown: row.unknown, errors: row.errors, pageErrors: row.pageErrors,
      failedRequests: row.failedRequests, warnings: row.warnings,
      headings: row.content?.headings,
      failedAuditIds: row.failedAudits?.map(audit => audit.id),
      lighthouseVersion: row.lighthouseVersion, throttling: row.throttling,
      artifact: `${folder}/${row.route}-${row.run}.json`,
    });
  }
}
for (const profile of ['mobile', 'desktop']) {
  const readOptional = async (name, mode) => {
    try {
      return JSON.parse(await fs.readFile(path.join(process.env.TEMP, `ekavyu-remaining-${name}-${profile}-${mode}`, 'summary.json'), 'utf8'));
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  for (const retry of await readOptional(`${stage}-retry`, 'lighthouse')) {
    const index = evidence.findIndex(row => row.route === retry.route && row.profile === profile && row.status !== 'validated');
    if (index < 0) throw new Error('Retry must replace an unverified observation, never select a favorable score');
    replacedAttempts.push(evidence[index]);
    evidence[index] = { ...retry, artifact: `ekavyu-remaining-${stage}-retry-${profile}-lighthouse/${retry.route}-${retry.run}.json`,
      failedAuditIds: retry.failedAudits?.map(audit => audit.id), failedAudits: undefined, content: undefined, requests: undefined };
  }
  interactions.push(...await readOptional(stage, 'interaction'));
  repeated.push(...await readOptional(`${stage}-repeat`, 'lighthouse'));
  baselineRepeated.push(...await readOptional(`${stage}-baseline-repeat`, 'lighthouse'));
  accessibilityInitial.push(...await readOptional(`${stage}-labels`, 'accessibility'));
  accessibility.push(...await readOptional(`${stage}-labels-final`, 'accessibility'));
  publicFollowup.push(...await readOptional(`${stage}-public`, 'lighthouse'));
  publicAccessibility.push(...await readOptional(`${stage}-public`, 'accessibility'));
  publicInteractions.push(...await readOptional(`${stage}-public`, 'interaction'));
}
const canonical = value => value.split('?')[0]
  .replace('/browse/audit-clinic', '/browse/[slug]')
  .replace('/doctor/audit-doctor', '/doctor/[slug]')
  .replace('/join/audit-clinic', '/join/[locationSlug]')
  .replace(/\/patients\/[a-f0-9]{24}/, '/patients/[id]')
  .replace(/\/consultations\/[a-f0-9]{24}/, '/consultations/[id]')
  .replace(/\/track\/[a-f0-9]{24}/, '/track/[appointmentId]');
const uncovered = inventory.routes.filter(item => !routes.some(route => canonical(route.path) === item.route));
const unexpected = routes.filter(route => !inventory.routes.some(item => canonical(route.path) === item.route));
if (uncovered.length || unexpected.length) throw new Error(`Route inventory mismatch: ${JSON.stringify({ uncovered, unexpected })}`);
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const measurements = (name, profile) => {
  const followup = publicFollowup.filter(row => row.route === name && row.profile === profile);
  return followup.length ? followup : evidence.filter(row => row.route === name && row.profile === profile);
};
const status = rows => rows.length && rows.every(row => row.status === 'validated' && row.cold) ? 'Audited' : 'Unverified';
const score = (rows, category) => median(rows.filter(row => row.status === 'validated').map(row => row.scores?.[category])) ?? '?';
const cells = route => {
  const mobile = measurements(route.name, 'mobile'), desktop = measurements(route.name, 'desktop');
  return `${score(mobile, 'performance')} / ${score(desktop, 'performance')} | ${score(mobile, 'accessibility')} / ${score(desktop, 'accessibility')} | ${score(mobile, 'best-practices')} / ${score(desktop, 'best-practices')}`;
};
const wcagStatus = (name, profile) => {
  const row = publicAccessibility.find(item => item.route === name && item.profile === profile) || accessibility.find(item => item.route === name && item.profile === profile);
  return row ? row.status === 'validated' ? 'Pass' : 'Failed' : 'Pending';
};
const table = inventory.routes.map(item => {
  const reps = routes.filter(route => canonical(route.path) === item.route);
  return reps.map((route, index) => {
    const rows = [...measurements(route.name, 'mobile'), ...measurements(route.name, 'desktop')];
    const audited = ['mobile', 'desktop'].every(profile => status(measurements(route.name, profile)) === 'Audited');
    const performance = rows.every(row => row.scores?.performance >= 90) ? 'Monitor; one sample/profile' : 'Performance remains partial';
    const seo = ['/', '/pricing', '/browse', '/browse/[slug]', '/doctor/[slug]'].includes(item.route)
      ? 'Production indexing policy tested; local noindex' : 'N/A; intentional noindex';
    const missing = ['mobile', 'desktop'].some(profile => !measurements(route.name, profile).length);
    return `| ${index ? 'Additional role: ' : ''}\`${item.route}\`${route.role ? ` (${route.role})` : ''} | ${audited ? 'Audited' : missing ? 'Pending profile' : 'Unverified'} | ${cells(route)} | ${wcagStatus(route.name, 'mobile')} / ${wcagStatus(route.name, 'desktop')} | ${seo} | ${performance} |`;
  }).join('\n');
}).join('\n');
const validated = evidence.filter(row => row.status === 'validated');
for (const row of validated) {
  if (['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'].some(metric => !Number.isFinite(row.metrics?.[metric]))) {
    throw new Error(`Validated observation is missing a numeric metric: ${row.profile}/${row.route}`);
  }
}
const failures = evidence.filter(row => row.status !== 'validated');
const problems = evidence.filter(row => row.errors?.length || row.failedRequests?.length);
const summary = {
  generatedAt: new Date().toISOString(), stage, artifact: '.next/remaining-complete',
  templates: inventory.count, representatives: routes.length, observations: evidence.length,
  validated: validated.length, unverified: failures.length,
  pendingObservations: routes.length * 2 - evidence.length,
  accessibility100: validated.filter(row => row.scores.accessibility === 100).length,
  bestPractices100: validated.filter(row => row.scores['best-practices'] === 100).length,
  performanceBelow90: validated.filter(row => row.scores.performance < 90).length,
  rowsWithConsoleOrHttpErrors: problems.length,
  replacedUnverifiedAttempts: replacedAttempts.length,
  interactionChecks: interactions.length,
  interactionsValidated: interactions.filter(row => row.status === 'validated').length,
  wcagChecks: accessibility.length,
  wcagValidated: accessibility.filter(row => row.status === 'validated').length,
  wcagFollowupArtifact: '.next/remaining-aria',
  wcagFollowupBuildId: accessibility[0]?.buildId,
  performanceHomeHeading: evidence.find(row => row.route === 'home')?.headings?.[0],
  accessibilityHomeHeading: accessibility.find(row => row.route === 'home')?.content?.headings?.[0],
  publicFollowupObservations: publicFollowup.length,
  publicFollowupWcag: publicAccessibility.length,
  publicFollowupInteractions: publicInteractions.length,
  publicFollowupArtifact: publicFollowup[0]?.buildDist,
  publicFollowupBuildId: publicFollowup[0]?.buildId,
  patientClsMedianBefore: median(baselineRepeated.filter(row => row.route === 'dashboard-patient' && row.status === 'validated').map(row => row.metrics['cumulative-layout-shift'])),
  patientClsMedianAfter: median(repeated.filter(row => row.route === 'dashboard-patient' && row.status === 'validated').map(row => row.metrics['cumulative-layout-shift'])),
  buildId: (await fs.readFile('.next/remaining-complete/BUILD_ID', 'utf8')).trim(),
};
const clsResult = summary.patientClsMedianBefore !== null && summary.patientClsMedianAfter !== null
  ? `\n\nRepeated patient-dashboard CLS median: ${summary.patientClsMedianBefore.toFixed(4)} to ${summary.patientClsMedianAfter.toFixed(4)} across three cold samples each. Performance targets remain partial; individual pilot results below are historical diagnostics.` : '';
const intro = `All ${inventory.count} page templates are represented by ${routes.length} initial views, including four dashboard roles. ${validated.length}/${evidence.length} collected observations validated; ${failures.length} remain unverified and ${summary.pendingObservations} profile observations are pending. These are local production-artifact audits with synthetic records, not deployed or real-user measurements. An audited initial view does not mean all workflow variants or performance targets are complete.${clsResult}`;
await fs.mkdir('docs/performance', { recursive: true });
const compact = row => ({ ...row, headings: row.content?.headings, failedAuditIds: row.failedAudits?.map(audit => audit.id), failedAudits: undefined, content: undefined, requests: undefined });
await fs.writeFile(output + '.json', JSON.stringify({ summary, inventory: inventory.routes, evidence, replacedAttempts, interactions: interactions.map(compact), repeated: repeated.map(compact), baselineRepeated: baselineRepeated.map(compact), accessibilityInitial: accessibilityInitial.map(compact), accessibility: accessibility.map(compact), publicFollowup: publicFollowup.map(compact), publicAccessibility: publicAccessibility.map(compact), publicInteractions: publicInteractions.map(compact) }, null, 2) + '\n');
await fs.writeFile('docs/performance/lighthouse-progress.md', `# Website-wide Lighthouse progress

Updated ${new Date().toISOString()}.

${intro}

[Implementation, verification and limitations](lighthouse-remaining-2026-10-23.md).
Scores are mobile / desktop, one cold observation each unless the JSON contains repeated runs.
Pricing uses the latest public-prefetch follow-up (three mobile samples and one desktop sample).
\`Audited\` describes coverage; performance below 90 remains partial.
The automated WCAG column covers the final build and retains manual-review findings in the report.
No deploy or paid infrastructure change was made.

| Page / representative | Coverage | Performance M / D | Accessibility M / D | Best Practices M / D | Automated WCAG M / D | SEO | Remaining work |
| --- | --- | --- | --- | --- | --- | --- | --- |
${table}

## Remaining variants

Account OTP/MFA, expired invitation/reset/verification links, saved pharmacy signup and recovery,
empty/error/permission-denied states, organization-admin/nurse/front-desk/family dashboard variants, large datasets
and clinical/financial transaction journeys are not exhaustive Lighthouse coverage.
Existing focused tests cover affected behavior; synthetic initial views do not prove deployed API
authorization or persistence.

Continue from the lowest mobile performance rows using a trace and repeated cold measurements on
an otherwise idle machine. Keep private/preview noindex, CSP, tenant checks and transaction boundaries
intact. Do not compare earlier retained-storage private diagnostics with these cold measurements.
`);
await fs.writeFile(output + '.md', `# Remaining-page Lighthouse implementation\n\n${intro}\n\n[Every route and both profiles](lighthouse-progress.md) · [Compact measurements](lighthouse-remaining-2026-10-23.json) · [Reproduction instructions](../../scripts/performance/README.md)\n\n## Result\n\n- Accessibility 100: ${summary.accessibility100}/${validated.length} validated observations.\n- Best Practices 100: ${summary.bestPractices100}/${validated.length}.\n- Performance below 90: ${summary.performanceBelow90}/${validated.length}; optimization is still partial.\n- Console/HTTP diagnostics: ${problems.length} observations; inspect their retained errors in the JSON. A successful view is not a claim of an error-free browser console.\n\n## Implemented\n\n- Shared dashboard: load the AI interface and notification list after opening; stop speculative sidebar/mobile route prefetching; preserve SPA navigation and permitted links. Drawer gesture styling now uses stylesheet CSS so strict CSP accepts it.\n- Dashboard stability: use real stat-card skeletons and a shared minimum height. A targeted patient pilot reduced CLS from 0.1366 to 0.00012; this is a single matched diagnostic, not a site-wide speed claim.\n- Accessibility across remaining modules: heading hierarchy, main landmarks, date-picker visible labels, notification/menu/count names, progress naming and booking/tracker contrast. Clinical and financial operations retain their existing authority and transaction logic.\n- Public pricing: reuse the public-plan query cache, including explicitly invalidating cached empty results before retry.\n- Operational pages: meaningful tracking/check-in/queue landmarks and populated synthetic views; replace a broken bare /track link with reception/private-link guidance.\n- SEO policy: public production indexing is consistent across metadata, proxy headers, robots and sitemap; previews, private pages and capability links remain noindex. Lower local SEO scores are expected and are not fixed by removing these controls.\n\n## Verification\n\nScoped lint, affected Vitest files and the final isolated Next production build/type check passed. Covered consumers include date controls, MRN/timeline, plan retry, clinical workspace loading, notification/PWA isolation, navigation/gestures and operational trackers. This is scoped verification, not a full release or backend regression suite. No backend implementation changed.\n\nThe build used \`.next/remaining-complete\`, Lighthouse 13.5.0 and disposable Chrome contexts with cold HTTP/memory/CacheStorage resets retaining synthetic cookies. API responses use 40 ms fixture latency; local TLS WebSocket connections are real. Unknown fixture endpoints invalidate a view. Each measurement validates its route, single main/h1, populated content, browser exceptions and horizontal overflow. The JSON records actual throttling. Full reports remain in TEMP under \`ekavyu-remaining-${stage}-<profile>-lighthouse\`.\n\n## Interpretation and continuation\n\nPrivate cold mobile pages still spend substantial time on JavaScript and hydration. Investigate the slowest traces before further shared loading changes. A direct-import experiment reduced one UI chunk but increased total JS (929,393 to 1,003,646 bytes in its matched doctor sample); it was removed. The retained notification split was smaller. Repeated baselines must use the same cold settings; earlier private retained-storage runs are diagnostics only.\n\nThe homepage was concurrently redesigned by separate user work, so its old/new scores are not evidence for this optimization. The artifact freezes that homepage version; subsequent local edits require a new build before comparison. This machine also had concurrent development activity, so single-run performance fluctuations must not be presented as repeatable improvements.\n\nLive Vercel/Render latency, backend cold starts, field Core Web Vitals, production indexing/crawl results and every mutation/auth variant remain unmeasured here. No deployment or new CI dependency was performed. Keep the existing release gates.\n`);
console.log(JSON.stringify(summary, null, 2));
const repeatedGroups = [...new Set(repeated.map(row => `${row.profile}|${row.route}`))];
const slowest = validated.filter(row => row.profile === 'mobile').sort((a, b) => a.scores.performance - b.scores.performance).slice(0, 8);
await fs.appendFile(output + '.md', `\n## Next performance targets\n\nThese are the lowest observed mobile scores in the complete sweep, not repeated rankings. Use their retained traces to separate JavaScript, layout and data-read costs before changing shared code.\n\n| Representative | P | LCP ms | TBT ms | CLS |\n| --- | --- | --- | --- | --- |\n${slowest.map(row => `| ${row.route} | ${row.scores.performance} | ${Math.round(row.metrics['largest-contentful-paint'])} | ${Math.round(row.metrics['total-blocking-time'])} | ${row.metrics['cumulative-layout-shift'].toFixed(4)} |`).join('\n')}\n`);
if (repeatedGroups.length || interactions.length) {
  const repeatedTable = repeatedGroups.map(key => {
    const [profile, route] = key.split('|');
    const rows = repeated.filter(row => row.profile === profile && row.route === route && row.status === 'validated');
    return `| ${route} | ${profile} | ${rows.length} | ${median(rows.map(row => row.scores.performance))} | ${Math.round(median(rows.map(row => row.metrics['largest-contentful-paint'])))} | ${Math.round(median(rows.map(row => row.metrics['total-blocking-time'])))} | ${median(rows.map(row => row.metrics['cumulative-layout-shift']))} |`;
  }).join('\n');
  await fs.appendFile(output + '.md', `\n## Interaction and repeated checks\n\n${summary.interactionsValidated}/${summary.interactionChecks} browser interaction checks validated. Details and any failures are preserved in the JSON. ${summary.replacedUnverifiedAttempts} failed initial observations required explicit retries; their original reasons are retained under \`replacedAttempts\`.\n\n${repeatedGroups.length ? `Repeated final cold samples are separate from the one-observation route table. They describe final variability, without asserting an old/new improvement.\n\n| Representative | Profile | Valid samples | Median P | Median LCP ms | Median TBT ms | Median CLS |\n| --- | --- | --- | --- | --- | --- | --- |\n${repeatedTable}\n` : ''}`);
}
if (accessibility.length) {
  await fs.appendFile(output + '.md', `\n## Detailed accessibility follow-up\n\nThe main Lighthouse sweep reported Accessibility 100, but its unscored visible-label rule still identified notifications, avatar initials, mobile More, timeline categories, queue-date selection and the tracker link. The final corrections are in \`.next/remaining-aria\`, after the intermediate \`.next/remaining-accessibility\` build. The full-route performance table belongs to the earlier frozen artifact; no speed improvement is claimed for name-only edits.\n\nThe final WCAG 2 A/AA and 2.1 A/AA axe pass validated ${summary.wcagValidated}/${summary.wcagChecks} populated views across both profiles. Violations and items requiring manual review are retained separately in the JSON; automated checks are not exhaustive accessibility certification.\n`);
}
if (baselineRepeated.length && repeated.length) {
  const pairs = repeatedGroups.map(key => {
    const [profile, route] = key.split('|');
    const before = baselineRepeated.filter(row => row.profile === profile && row.route === route && row.status === 'validated');
    const after = repeated.filter(row => row.profile === profile && row.route === route && row.status === 'validated');
    if (!before.length || !after.length) return null;
    if ([...before, ...after].some(row => !row.cold)) throw new Error('Cannot compare retained-storage and cold samples');
    const metric = (rows, name) => median(rows.map(row => row.metrics[name]));
    const values = (get, digits = 0) => `${get(before).toFixed(digits)} / ${get(after).toFixed(digits)}`;
    return `| ${route} (${profile}) | ${before.length} / ${after.length} | ${values(rows => median(rows.map(row => row.scores.performance)))} | ${values(rows => median(rows.map(row => row.scores['best-practices'])))} | ${values(rows => metric(rows, 'largest-contentful-paint'))} | ${values(rows => metric(rows, 'total-blocking-time'))} | ${values(rows => metric(rows, 'cumulative-layout-shift'), 4)} | ${values(rows => median(rows.map(row => row.network.scriptBytes)))} |`;
  }).filter(Boolean);
  await fs.appendFile(output + '.md', `\n## Repeated cold comparison\n\nBefore uses \`.next/remaining-baseline\`; after uses the artifact recorded on each repeated row. Both use the same current synthetic contracts, cold settings and Lighthouse version. Public-plan caching already existed in this baseline: pricing therefore checks stability, while its warm navigation benefit is measured separately. The homepage is excluded because of the concurrent redesign. Three samples cannot remove concurrent machine-load variance; inspect ranges in the raw measurements before asserting a speed gain. JS resource bytes are uncompressed; transfer bytes are recorded separately in the JSON.\n\n| Representative | Samples B / A | Median P B / A | Median BP B / A | LCP ms B / A | TBT ms B / A | CLS B / A | JS resource bytes B / A |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${pairs.join('\n')}\n`);
}
if (accessibility.length) {
  await fs.appendFile(output + '.md', `\nThe first detailed desktop pass also exposed joined account/tracker text, plural filter labels and a patient-table row containing other controls. Final corrections use \`.next/remaining-aria\`: explicit word boundaries, supported avatar image/category group roles, names containing the visible filter text, and existing patient-profile links without an enclosing row button. Original WCAG findings remain under \`accessibilityInitial\`; final checks are under \`accessibility\`. The unread badge is static: its palette contrast is 5.43:1 in light mode and 8.20:1 in dark mode; the previous opacity pulse reduced that contrast.\n\nManual-review findings, including gradient backgrounds and icon-only pagination, remain in the JSON. Automated absence of violations is not a claim that every gradient, theme, zoom level or assistive-technology workflow has been manually certified.\n`);
}
await fs.appendFile(output + '.md', `\n## Final scoped regression checks\n\nThe label/navigation check set passed 98 cases across seven files after updating three exact-name queue selectors; the final avatar/timeline/patient-directory/appointment/tracker set passed 45 cases across six files. These sets overlap and must not be added into a unique-test count. The patient-directory assertion checks that every profile link remains a link without a surrounding row button. Scoped ESLint passed, and the final production build completed compilation and package TypeScript. No final test-file type-check or full release-suite result is claimed.\n`);
if (publicFollowup.length) {
  const pricing = publicFollowup.filter(row => row.route === 'pricing' && row.profile === 'mobile' && row.status === 'validated');
  await fs.appendFile(output + '.md', `\n## Public navigation follow-up\n\nThe preceding repeated pricing median did not improve. Its trace contained seven speculative RSC requests, including a plan-specific onboarding redirect, during initial rendering. The shared public navbar and public-plan CTA now disable automatic prefetch; links and client navigation remain available. The signed-in public account label also includes its visible initials/name. This change uses \`.next/remaining-public\` and has its own retained measurements.\n\nLatest pricing: ${pricing.length} mobile samples, median performance ${median(pricing.map(row => row.scores.performance))}, median initial RSC requests ${median(pricing.map(row => row.network.prefetchRequests))} and median total requests ${median(pricing.map(row => row.network.requests))}. The earlier trace had seven RSC and 26 total requests. The route tracker uses this latest pricing follow-up while keeping the complete original sweep in JSON. ${publicAccessibility.filter(row => row.status === 'validated').length}/${publicAccessibility.length} affected public WCAG views and ${publicInteractions.filter(row => row.status === 'validated').length}/${publicInteractions.length} pricing-to-browse interactions validated.\n`);
  await fs.appendFile(output + '.md', '\nPublic navigation, plan recovery and homepage pricing checks passed 20 cases across three files. Scoped lint and the isolated public-follow-up production build/type check passed. Pricing remains below its earlier baseline median of 91; the retained improvement is fewer initial requests, with no claim of a completed cold-start performance target.\n');
}
if (failures.length || evidence.length !== routes.length * 2 || interactions.length !== 4 || interactions.some(row => row.status !== 'validated') || repeated.some(row => row.status !== 'validated') || baselineRepeated.some(row => row.status !== 'validated') || accessibility.length !== routes.length * 2 || accessibility.some(row => row.status !== 'validated') || publicFollowup.length !== 4 || publicAccessibility.length !== 10 || publicInteractions.length !== 2 || [...publicFollowup, ...publicAccessibility, ...publicInteractions].some(row => row.status !== 'validated')) process.exitCode = 1;
