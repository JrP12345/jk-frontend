# Ekavyu frontend

Next.js, React and Tailwind frontend for Ekavyu. Official tagline: **Care That
Keeps Moving**. This repository builds independently of the backend checkout.

Use Node.js 24. Run `npm ci`, copy `.env.example` to `.env.local`, configure the
backend API URL, then run `npm run dev`. The default port is 3000.

Checks: `npm test`, `npm run lint`, `npm run check:types`,
`npm run check:payments`, `npm run build`.

For normal coding, use the [risk-based verification workflow](docs/verification-workflow.md)
to select affected checks; CI retains the complete quality gate.

The transparent SVG master is in `assets/brand`; regenerate vector/icon exports with
`npm run brand:assets`, then `npm run brand:social` for the homepage share image.
The Dockerfile serves the standalone production build.
`NEXT_PUBLIC_API_URL` must be supplied at build time.
Production Next configuration and Docker builds require an absolute HTTPS API
URL without credentials/query/fragment and reject loopback hosts. Configure the
actual deployed `/api` URL before building; `.env.example` is for development.
An optional `NEXT_PUBLIC_BACKEND_URL` must also use HTTPS. The CI build uses a
non-routable HTTPS fixture URL and its artifact is not a deployment artifact.
`BACKEND_INTERNAL_URL`, when used for server fetches/rewrites, remains server-only
and must identify the reachable backend, not the frontend's own rewrite endpoint.

### Vercel configuration failure

If `next build` reports `NEXT_PUBLIC_API_URL must be an absolute HTTPS URL`
while loading `next.config.ts`, open the project's **Settings > Environment
Variables** and set `NEXT_PUBLIC_API_URL` for **Production** to the actual backend
API URL, including `/api`. For example, `https://your-backend.onrender.com/api`
shows the required shape; replace the hostname with the deployed backend's URL.
Use the backend service's URL, not the Vercel frontend URL, to avoid a rewrite loop.
Enter the value without surrounding quotes, whitespace or angle brackets.

If `NEXT_PUBLIC_BACKEND_URL` or `BACKEND_INTERNAL_URL` is set, ensure it targets
the same reachable backend; the public backend URL must also be HTTPS. Configure
Preview separately if preview deployments are needed. Save and redeploy: public
variables are compiled into browser code, so changing a dashboard value does not
repair an existing deployment. Keep the production URL guard enabled.

If the Render backend exits with a missing `PRESCRIPTION_SIGNING_KEY`, restore
its persistent signing secret using the backend's
[Render recovery instructions](../backend/DEPLOYMENT.md#missing-prescription-signing-key-on-render).
Wait for `/api/health/readiness` on that backend to return HTTP 200, then check
login and API requests from the deployed frontend. These are environment repairs;
a successful local build alone does not certify either deployed service.

## Documentation

`docs` contains current topic guides. Completed task reports are consolidated
into these guides; dated verification remains labelled separately from open
release requirements.

| Area | Start here |
| --- | --- |
| Development | [Verification workflow](docs/verification-workflow.md), [dependencies](docs/dependencies.md), [cleanup progress](docs/pre-production-cleanup.md) |
| Interface | [Design and brand assets](docs/design-system.md), [interaction, loading and printing](docs/interaction-patterns.md), [homepage](docs/homepage-design.md) |
| Clinic and discovery | [Organization management](docs/organization-management.md), [everyday clinic workflow](docs/small-clinic-workflow.md), [Browse-page handoff](docs/browse-pages-handoff.md), [public discovery](docs/public-discovery.md) |
| CRM | [Workflows and acceptance](docs/crm-workflows.md), [operator review and pilot](docs/crm-migration-pilot.md) |
| Pharmacy | [Scope and guide index](docs/pharmacy-production-plan.md), [release and setup](docs/pharmacy-release-evidence.md) |
| Architecture and release | [Domain model](docs/domain-model-audit.md), [security review](docs/application-security-audit.md), [workflow coverage](docs/workflow-coverage.md), [operational gates](docs/production-readiness-tracker.md) |
| Performance and hosting | [Measurements and reliability](docs/lighthouse-performance.md), [Cloudflare/Vinext decision](docs/cloudflare-vinext-blockers.md) |

Backend source and operational runbooks live in the sibling checkout and the
[backend repository](https://github.com/JrP12345/jk-backend).
