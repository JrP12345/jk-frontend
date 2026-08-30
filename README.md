# HealthOS / Anant Health — Frontend Web Application

An enterprise healthcare platform frontend built with **Next.js 16 (App Router)**, **React 19**, **Zustand**, **TanStack Query**, and custom **Tailwind CSS v4** design components.

---

## Technical Stack

- **Framework**: Next.js 16 App Router (`next`)
- **UI Library**: React 19 (`react`, `react-dom`)
- **State Management**: Zustand (`zustand`) & TanStack React Query (`@tanstack/react-query`)
- **HTTP Client**: Axios (`axios`) with `withCredentials: true` and automatic 401 token refresh queue ([src/lib/api.ts](file:///d:/Project%20JK/frontend/src/lib/api.ts))
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`, `tailwindcss`)
- **Icons**: Lucide React (`lucide-react`)
- **Testing**: Vitest (`vitest`), Testing Library (`@testing-library/react`), JSDOM (`jsdom`)

---

## Page Routes Inventory (`src/app/`)

| Page Route | Access Level / Permission | Purpose |
| :--- | :--- | :--- |
| `/login` | Public / Unauthenticated | Login & Patient Self-Registration tabs |
| `/onboarding` | Public (Dev mode) / Admin | Multi-step Organization onboarding stepper & 2FA TOTP |
| `/browse` | Public / All | Public hospital & clinic directory search |
| `/dashboard` | Authenticated (All) | Main overview dashboard with quick stats |
| `/dashboard/queue` | Staff (`VIEW_APPOINTMENTS`) | Live OPD patient queue & token caller |
| `/dashboard/consultations/[id]` | Doctor / Staff (`MANAGE_CLINICAL_NOTES`) | Interactive 6-tab Clinical Consultation Workspace |
| `/dashboard/appointments` | Authenticated (All) | Outpatient appointment booking & schedule grid |
| `/dashboard/admissions` | Staff (`VIEW_APPOINTMENTS`) | IPD Ward bed management & admission tracking |
| `/dashboard/pharmacy` | Staff (`VIEW_APPOINTMENTS`) | Drug inventory lookup & prescription dispensing |
| `/dashboard/laboratory` | Staff / Patient | Diagnostic lab catalog, order tracking & lab results |
| `/dashboard/billing` | Staff (`VIEW_APPOINTMENTS`) | Staff invoicing, line item charges & payment collection |
| `/dashboard/bills` | Patient | Patient invoice overview |
| `/dashboard/staff` | Admin / Staff (`VIEW_STAFF`) | User provisioning & RBAC permission controls |
| `/dashboard/clinics` | Admin / Staff (`VIEW_CLINICS`) | Multi-facility clinic & department setup |
| `/dashboard/organizations` | Root Super-Admin | Platform organization management & context switch |
| `/dashboard/patients/[id]/timeline` | Staff (`VIEW_EHR`) | Longitudinal patient EHR timeline |
| `/dashboard/analytics` | Admin / Staff (`MANAGE_ORGANIZATION`) | Executive quality metrics & KPI analytics |
| `/dashboard/audit` | Admin / Staff | Immutable system audit log viewer |
| `/dashboard/settings` | Admin / Staff | Organization settings & doctor scheduling assignments |
| `/dashboard/settings/notifications` | Authenticated (All) | In-app & email notification preferences |

---

## Application Architecture & Security Layers

1. **Proxy Middleware (`src/proxy.ts`)**: Evaluates `refresh_token` httpOnly cookie on `/dashboard/*` routes, redirecting unauthenticated sessions to `/login`.
2. **Client Route Guard (`src/lib/routePermissions.ts`)**: Checks `user.role` and `user.permissions` against path rules, showing an Access Denied toast and redirecting unauthorized navigation attempts.
3. **Global Auth Store (`src/store/authStore.ts`)**: Zustand store managing authenticated user state, permissions array, active clinic context (`activeClinicId`), and transparent logout cleanup.
4. **Coordinated Consultation Workspace (`src/components/clinical/EncounterWorkspace.tsx`)**: Integrates `SOAPNoteEditor`, `MARRow`, `NEWS2Calculator`, `PatientHeader`, diagnostic order modals, and FHIR R4 document export trigger.

---

## Environment Setup (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
ONBOARDING_SECRET=your_secret_key_here
```

---

## Running Development & Production Build

1. **Install Dependencies**: `npm install`
2. **Start Dev Server**: `npm run dev` (Runs on `http://localhost:3000`)
3. **Run Component Tests**: `npm test`
4. **Production Build**: `npm run build` (**Clean 0 errors across 22 static pages**).
