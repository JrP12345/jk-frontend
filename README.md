# Ekavyu frontend

Next.js, React and Tailwind frontend for Ekavyu. Official tagline: **Care That
Keeps Moving**. This repository builds independently of the backend checkout.

Use Node.js 24. Run `npm ci`, copy `.env.example` to `.env.local`, configure the
backend API URL, then run `npm run dev`. The default port is 3000.

Checks: `npm test`, `npm run lint`, `npm run check:payments`, `npm run build`.

For normal coding, use the [risk-based verification workflow](docs/verification-workflow.md)
to select affected checks; CI retains the complete quality gate.

The supplied logo is `public/image.png`; regenerate exports with
`npm run brand:assets`. The Dockerfile serves the standalone production build.
`NEXT_PUBLIC_API_URL` must be supplied at build time.
Production Next configuration and Docker builds require an absolute HTTPS API
URL without credentials/query/fragment and reject loopback hosts. Configure the
actual deployed `/api` URL before building; `.env.example` is for development.
An optional `NEXT_PUBLIC_BACKEND_URL` must also use HTTPS. The CI build uses a
non-routable HTTPS fixture URL and its artifact is not a deployment artifact.
`BACKEND_INTERNAL_URL`, when used for server fetches/rewrites, remains server-only
and must identify the reachable backend, not the frontend's own rewrite endpoint.

- [UI interaction patterns](docs/interaction-patterns.md)
- [Current refinement ledger](docs/frontend-refinement.md)
- [Dependencies and licenses](docs/dependencies.md)
- [Visual identity and logo exports](docs/ekavyu-visual-identity.md)
- [Validation history](docs/production-readiness-tracker.md)
- [Phase 1 final production gate](docs/phase1-final-production-gate.md)
- [Backend repository](https://github.com/JrP12345/jk-backend)
