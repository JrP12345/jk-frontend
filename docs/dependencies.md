# Dependencies and licenses

Direct npm dependencies reviewed on 2026-10-04 against source, scripts,
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
| `@tanstack/react-query` | 5.104.1 | MIT | Shared query/cache requests |
| `axios` | 1.20.0 | MIT | Canonical API requests |
| `lucide-react` | 1.50.0 | ISC | UI icons |
| `next` | 16.3.8 | MIT | App Router/build/server |
| `qrcode` | 1.5.4 | MIT | Token/poster/payment QR codes |
| `react` | 19.3.0 | MIT | Components/hooks |
| `react-dom` | 19.3.0 | MIT | DOM rendering/portals |
| `zustand` | 5.0.15 | MIT | Workspace stores |

## Development dependencies

| Package | Locked version | License | Required use |
| --- | --- | --- | --- |
| `@tailwindcss/postcss` | 4.3.3 | MIT | PostCSS build plugin |
| `@testing-library/dom` | 10.4.2 | MIT | Required React Testing Library peer |
| `@testing-library/jest-dom` | 7.0.1 | MIT | DOM test assertions |
| `@testing-library/react` | 16.3.3 | MIT | Component/flow tests |
| `@types/node` | 26.6.4 | MIT | Types for node APIs |
| `@types/qrcode` | 1.5.6 | MIT | Types for qrcode APIs |
| `@types/react` | 19.3.0 | MIT | Types for react APIs |
| `@types/react-dom` | 19.3.0 | MIT | Types for react-dom APIs |
| `eslint` | 9.39.5 | MIT | Lint CLI; newest release supported by the installed Next lint plugins |
| `eslint-config-next` | 16.3.8 | MIT | Next/React lint rules |
| `jsdom` | 29.1.1 | MIT | Vitest DOM environment |
| `sharp` | 0.35.5 | Apache-2.0 | Existing logo/icon generation script |
| `tailwindcss` | 4.3.3 | MIT | CSS utilities and tokens |
| `@typescript/native` | 7.0.2 | Apache-2.0 | Native TypeScript 7 compiler (`tsc`) |
| `typescript` | 6.0.2 compatibility API | Apache-2.0 | Required by the installed `typescript-eslint` integration while it awaits TypeScript 7 API support |
| `vite` | 8.3.2 | MIT | Required non-optional Vitest peer |
| `vitest` | 5.0.3 | MIT | Test runner |

## Non-MIT dependencies and services

- `lucide-react` → ISC (MIT notices for Feather-derived icons) → UI icons → no replacement needed under the permissive-license policy. [Upstream license](https://lucide.dev/license).
- `sharp` → Apache-2.0 → development asset exports → no replacement needed. Declared directly at the already locked version rather than relying on Next's optional transitive install. Existing native libvips packages carry separate LGPL-3.0-or-later notices; preserve them when distributing binaries. [Sharp license](https://github.com/lovell/sharp/blob/main/LICENSE).
- `@typescript/native` and `typescript` → Apache-2.0 → compiler tooling and the temporary TypeScript 6 API compatibility layer → no replacement needed. [TypeScript license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt).

No premium UI package or commercial component runtime appears in the direct
manifest. Checkout/video/imaging integrations use intentional provider services.

The policy prefers MIT and accepts the recorded permissive exceptions; it is not
strictly MIT-only. Verify feature and stored-data compatibility before replacing
required packages. Use npm for dependency changes and retain license notices.
