# Dependencies and licenses

Direct npm dependencies reviewed on 2026-10-24 against source, scripts,
configuration, installed licenses and lockfiles. Update this inventory with the
manifest. All listed packages are open-source and require no commercial software
license for normal use. Provider charges and server licenses are separate.

No direct package was confirmed unused. Type packages, configured plugins and
mandatory tool peers remain required without a runtime import. No dependency
versions were upgraded during cleanup.

## Production dependencies

| Package | Locked version | License | Required use |
| --- | --- | --- | --- |
| `@simplewebauthn/browser` | 14.0.0 | MIT | Passkeys |
| `@tanstack/react-query` | 5.104.3 | MIT | Shared query/cache requests |
| `@vinext/cloudflare` | 1.1.1 | MIT | Cloudflare deployment adapter for the Vinext evaluation |
| `axios` | 1.20.0 | MIT | Canonical API requests |
| `lucide-react` | 1.59.0 | ISC | UI icons |
| `leaflet` | 1.9.4 | BSD-2-Clause | On-demand interactive Browse map; added 27 October 2026 |
| `next` | 16.4.2 | MIT | App Router/build/server |
| `qrcode` | 1.5.4 | MIT | Token/poster/payment QR codes |
| `react` | 19.3.1 | MIT | Components/hooks |
| `react-dom` | 19.3.1 | MIT | DOM rendering/portals |
| `react-server-dom-webpack` | 19.3.1 | MIT | Vinext React Server Components transport |
| `vinext` | 1.2.1 | MIT | Vite implementation evaluated by the Cloudflare scripts |
| `zustand` | 5.0.15 | MIT | Workspace stores |

## Development dependencies

| Package | Locked version | License | Required use |
| --- | --- | --- | --- |
| `@cloudflare/vite-plugin` | 2.0.0-beta.v.1 | MIT | Local Workers runtime and Cloudflare build integration |
| `@tailwindcss/postcss` | 4.3.3 | MIT | PostCSS build plugin |
| `@types/leaflet` | 1.9.21 | MIT | TypeScript declarations for Browse's map integration |
| `@testing-library/dom` | 10.4.2 | MIT | Required React Testing Library peer |
| `@testing-library/jest-dom` | 7.0.1 | MIT | DOM test assertions |
| `@testing-library/react` | 16.3.3 | MIT | Component/flow tests |
| `@types/node` | 26.6.5 | MIT | Types for node APIs |
| `@types/qrcode` | 1.5.6 | MIT | Types for qrcode APIs |
| `@types/react` | 19.3.0 | MIT | Types for react APIs |
| `@types/react-dom` | 19.3.0 | MIT | Types for react-dom APIs |
| `@vitejs/plugin-react` | 6.1.2 | MIT | Required Vinext React transformation peer |
| `@vitejs/plugin-rsc` | 0.5.38 | MIT | Vinext server component build integration |
| `cf` | 1.0.0-beta.18 | MIT OR Apache-2.0 | Cloudflare command-line tooling |
| `eslint` | 9.39.5 | MIT | Lint CLI; newest release supported by the installed Next lint plugins |
| `eslint-config-next` | 16.4.2 | MIT | Next/React lint rules |
| `fast-glob` | local `packages/fast-glob` | MIT | Maintained local glob adapter used by Next and Vite; verified by `check:glob-tooling` |
| `jsdom` | 29.1.1 | MIT | Vitest DOM environment |
| `postcss` | 8.5.30 | MIT | Tailwind/Next/Vite CSS processing |
| `sharp` | 0.35.5 | Apache-2.0 | Existing logo/icon generation script |
| `tailwindcss` | 4.3.3 | MIT | CSS utilities and tokens |
| `@typescript/native` | 7.0.2 | Apache-2.0 | TypeScript 7 compiler explicitly invoked by `check:types` |
| `typescript` | 6.0.2 compatibility API | Apache-2.0 | Required by the installed `typescript-eslint` integration while it awaits TypeScript 7 API support |
| `vite` | 8.3.5 | MIT | Required Vitest and Vinext build/runtime peer |
| `vite-css-modules` | 1.16.0 | MIT | CSS module processing in the Vinext evaluation |
| `vitest` | 5.0.5 | MIT | Test runner |

## Non-MIT dependencies and services

- `lucide-react` → ISC (MIT notices for Feather-derived icons) → UI icons → no replacement needed under the permissive-license policy. [Upstream license](https://lucide.dev/license).
- `sharp` → Apache-2.0 → development asset exports → no replacement needed. Declared directly at the already locked version rather than relying on Next's optional transitive install. Existing native libvips packages carry separate LGPL-3.0-or-later notices; preserve them when distributing binaries. [Sharp license](https://github.com/lovell/sharp/blob/main/LICENSE).
- `@typescript/native` and `typescript` → Apache-2.0 → compiler tooling and the temporary TypeScript 6 API compatibility layer → no replacement needed. [TypeScript license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt).

No premium UI package or commercial component runtime appears in the direct
manifest. Checkout/video/imaging integrations use intentional provider services.

Cloudflare dependencies support an active evaluation, documented in
[Cloudflare/Vinext blockers](cloudflare-vinext-blockers.md). They are not unused
because the default build remains Next. Keep the local glob override and the
scoped Satori compression override with their consumer checks. The TypeScript 6
API package supports tooling; `npm run check:types` deliberately runs TypeScript
7 and writes its incremental cache under ignored `.next/cache`.

The policy prefers MIT and accepts the recorded permissive exceptions; it is not
strictly MIT-only. Verify feature and stored-data compatibility before replacing
required packages. Use npm for dependency changes and retain license notices.
