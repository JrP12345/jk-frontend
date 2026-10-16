import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const frontend = process.cwd();
const backend = path.resolve(frontend, '../backend');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const rel = (root, file) => path.relative(root, file).replaceAll('\\', '/');
const parse = file => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const text = node => node?.getText() || '';
const literal = node => node && (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
const visit = (node, fn) => { fn(node); ts.forEachChild(node, child => visit(child, fn)); };
const routes = [];
for (const file of [path.join(backend, 'index.ts'), path.join(backend, 'platform/gateway.ts'), ...walk(path.join(backend, 'routes')).filter(file => file.endsWith('.ts'))]) {
  const source = parse(file), bindings = new Map();
  visit(source, node => { if (ts.isVariableDeclaration(node) && node.initializer) bindings.set(text(node.name), node.initializer); });
  const guards = node => {
    const expanded = ts.isIdentifier(node) && bindings.has(text(node)) ? bindings.get(text(node)) : node;
    const found = [];
    visit(expanded, child => {
      if (ts.isCallExpression(child) && /check.*Permission|requireModule|denyRoles|requirePlatformRoot/.test(text(child.expression))) found.push(text(child));
      if (ts.isIdentifier(child) && /^(authenticate|enforceSubscriptionActive|requirePlatformRoot)$/.test(text(child))) found.push(text(child));
      if (ts.isSpreadAssignment(child) && bindings.has(text(child.expression))) found.push(...guards(child.expression));
    });
    return [...new Set(found)];
  };
  visit(source, node => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    const method = node.expression.name.text, receiver = text(node.expression.expression);
    if (!['app', 'fastify'].includes(receiver) || !['get','post','put','patch','delete','options','head'].includes(method)) return;
    const url = literal(node.arguments[0]);
    if (!url) return;
    const options = node.arguments.length > 2 ? node.arguments[1] : undefined;
    const prefix = file.endsWith('upload.ts') ? '/api' : file.endsWith('shifts.ts') ? '/api/shifts' : file.endsWith('gateway.ts') ? '/api/platform' : '';
    routes.push({ method: method.toUpperCase(), path: `${prefix}${url}`, source: rel(backend, file), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      guards: options ? guards(options) : [], handler: ts.isIdentifier(node.arguments.at(-1)) ? text(node.arguments.at(-1)) : 'inline' });
  });
}
const pages = walk(path.join(frontend, 'src/app')).filter(file => /[/\\]page\.tsx$/.test(file)).map(file => {
  const source = parse(file), calls = [], links = [];
  visit(source, node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && text(node.expression.expression) === 'api') calls.push(`${node.expression.name.text.toUpperCase()} ${text(node.arguments[0])}`);
    if (ts.isJsxAttribute(node) && text(node.name) === 'href') links.push(text(node.initializer));
  });
  const route = '/' + rel(frontend, file).replace(/^src\/app\//, '').replace(/\/page\.tsx$/, '').split('/').filter(part => !/^\(.*\)$/.test(part)).join('/');
  return { route: route === '/page.tsx' ? '/' : route, source: rel(frontend, file), directApiCalls: [...new Set(calls)], directLinks: [...new Set(links)] };
});
const modules = [];
visit(parse(path.join(backend, 'data/moduleKeys.ts')), node => {
  if (ts.isVariableDeclaration(node) && text(node.name) === 'MODULE_KEYS' && ts.isObjectLiteralExpression(node.initializer)) {
    for (const item of node.initializer.properties) if (ts.isPropertyAssignment(item)) modules.push({ key: literal(item.name) || text(item.name), definition: text(item.initializer) });
  }
});
const inventory = {
  scope: 'Static source inventory, not proof of runtime authorization or successful workflows. Guards can be inherited or enforced inside handlers; empty guards do not imply anonymous access. API calls/links are direct page references; shared components and hooks require separate tracing.',
  roles: ['root','admin','doctor','receptionist','nurse','lab_tech','pharmacist','cashier','location_manager','patient','family_member','guest','organization custom roles'],
  pages, routes, modules,
  models: walk(path.join(backend, 'models')).filter(file => file.endsWith('.ts')).map(file => rel(backend, file)),
  workersAndJobs: ['workers','jobs'].flatMap(dir => walk(path.join(backend, dir))).filter(file => file.endsWith('.ts')).map(file => rel(backend, file)),
};
fs.writeFileSync(path.join(frontend, 'docs/feature-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ pages: pages.length, routes: routes.length, models: inventory.models.length, workersAndJobs: inventory.workersAndJobs.length }));
