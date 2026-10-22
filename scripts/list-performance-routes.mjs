// Read-only route discovery; never import a route or execute application code.
import fs from 'node:fs/promises';
import path from 'node:path';

const routes = [];
async function visit(dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await visit(file);
    else if (/^page\.(?:tsx?|jsx?|mdx)$/.test(item.name)) {
      const relative = path.relative('src/app', file).split(path.sep).join('/');
      const route = '/' + relative.split('/').slice(0, -1).filter(part => !/^\(.+\)$/.test(part)).join('/');
      const family = relative.startsWith('(dashboard)/') ? 'private/dashboard'
        : relative.startsWith('(auth)/') ? 'auth/onboarding'
        : route.startsWith('/browse') || route.startsWith('/doctor') ? 'public/discovery'
        : 'public/other';
      const source = await fs.readFile(file, 'utf8');
      routes.push({ route, file: 'src/app/' + relative, family, clientBoundary: /^\s*["']use client["']/.test(source) });
    }
  }
}
await visit('src/app');
console.log(JSON.stringify({ count: routes.length, routes: routes.sort((a, b) => a.route.localeCompare(b.route)), representatives: ['/', '/browse', '/browse/audit-clinic', '/login', '/dashboard'] }, null, 2));
