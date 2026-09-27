# Ekavyu frontend

Next.js, React and Tailwind frontend for Ekavyu. Official tagline: **Care That
Keeps Moving**. This repository builds independently of the backend checkout.

Use Node.js 24. Run `npm ci`, copy `.env.example` to `.env.local`, configure the
backend API URL, then run `npm run dev`. The default port is 3000.

Checks: `npm test`, `npm run lint`, `npm run check:payments`, `npm run build`.
The supplied logo is `public/image.png`; regenerate exports with
`npm run brand:assets`. The Dockerfile serves the standalone production build.
`NEXT_PUBLIC_API_URL` must be supplied at build time.

- [UI refinement](docs/frontend-ui-refinement.md)
- [Visual identity and logo exports](docs/ekavyu-visual-identity.md)
- [Validation history](docs/production-readiness-tracker.md)
- [Backend repository](https://github.com/JrP12345/jk-backend)
