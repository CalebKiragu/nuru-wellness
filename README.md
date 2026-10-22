# Nuru Wellness

A white-label wellness booking and business-management MVP for independent massage therapists and boutique spas. It ships with two fully seeded demonstration studios — **Amani Bodywork** (botanical, Nairobi) and **Bahari House** (coastal, Mombasa) — a real booking engine, a tenant-scoped dashboard, a storefront editor with publish/rollback, and an AI assistant whose actions stop for human approval.

Built for the specification in the project brief. The demo is deliberate about what is real: bookings and dashboard records are persisted in the database; payments, SMS and email delivery are simulated unless a provider is explicitly configured.

---

## Stack

- Next.js 15 App Router, React 19, TypeScript
- Tailwind CSS 4 with the Nuru design tokens
- Drizzle ORM + PostgreSQL
- Zod validation and React Hook Form
- Vitest for unit/integration tests
- Playwright for end-to-end tests
- Deploy target: Render

### Database in this environment

There is no PostgreSQL server or Docker daemon in the development environment used to build this project. The app therefore supports two drivers:

| `DATABASE_URL` | Driver | Use |
| --- | --- | --- |
| unset | Embedded PGlite at `.nuru/pgdata` | Local development and demo |
| set | `node-postgres` | Production / Render |

Both use the same schema, migrations and SQL. PGlite is PostgreSQL-compatible and supports the advisory locking used by the booking engine. **Production should always set `DATABASE_URL`.**

---

## Quick start

```bash
npm install
cp .env.example .env.local
# Set SESSION_SECRET (openssl rand -hex 32), and leave DEMO_MODE=true for the demo
npm run dev
```

Open <http://localhost:3000>. With no tenant hostname the marketing landing appears; choose a demo studio from there.

- Dashboard: <http://localhost:3000/dashboard> (auto-signed in as the demo owner)
- Amani storefront: <http://amani.localhost:3000> (or use the demo switch)
- Bahari storefront: <http://bahari.localhost:3000>

On first request the app runs migrations and, when `DEMO_MODE=true`, seeds the two demonstration tenants if the database is empty. Delete `.nuru/pgdata` to start fresh.

### Demo auto-login

`DEMO_MODE=true` and `DEMO_AUTO_LOGIN=true` (both defaults in `.env.example`) let the demo open the dashboard, admin and dashboard APIs without a session. The active host decides which workspace owner is used:

- `amani.localhost` → `owner@amani.demo`
- `bahari.localhost` → `owner@bahari.demo`
- no tenant host → the demo-switched studio, or Amani by default
- `/admin` → `admin@nuru.demo`

The login page still works and still creates real database-backed sessions, so you can switch between roles if you want to demonstrate permissions. Set `DEMO_AUTO_LOGIN_EMAIL` to force a specific account.

> **Demo only.** Auto-login is ignored unless `DEMO_MODE=true`. Never enable it on a deployment that holds real customer data — anyone with the URL would act as an owner. Sessions are not created in auto-login mode, so signing out simply returns the next request to the demo owner.

### Demo accounts

Password for every seeded account: **`NuruDemo2026!`**

| Email | Role | Workspace |
| --- | --- | --- |
| `owner@amani.demo` | Owner | Amani Bodywork |
| `manager@amani.demo` | Manager | Amani Bodywork |
| `staff@amani.demo` | Staff | Amani Bodywork |
| `owner@bahari.demo` | Owner | Bahari House |
| `staff@bahari.demo` | Staff | Bahari House |
| `admin@nuru.demo` | Platform admin | Platform `/admin` |

In demo mode the login page exposes one-click buttons for the owner accounts and the platform admin. One-click sign-in still goes through the same server-side session creation as a password login.

---

## What is implemented

### Public storefront

- Mobile-first editorial design using the Forest / Sage / Ivory / Brass / Clay tokens, Cormorant Garamond display and DM Sans body type.
- Per-tenant theme tokens and content, curated sections: hero, services, about, team, gallery, testimonials, location.
- Service detail pages with duration, price, description, therapist and add-ons.
- Booking flow without an account: therapist, date, live server-side availability, add-ons, customer details, policy acceptance, review and confirmation.
- Confirmation page with reference, calendar link, simulated message preview and clear demo labelling.
- `/policies` and tenant-aware metadata/robots. Tenant content is selected by hostname; a hostname never grants dashboard access.
- Demo-only landing lists the two demo studios. In production (`DEMO_MODE=false`) that list is empty and there is no public tenant directory.

### Booking engine

- Availability is computed on the server from business hours, therapist weekly availability, time off, booking buffers, existing bookings and booking holds.
- Slot calculation is pure and unit-tested (`src/lib/availability.ts`); data loading is in `src/lib/availability-service.ts`.
- Booking creation revalidates availability **inside** a transaction after taking `pg_advisory_xact_lock(hashtext(tenant:staff:date))`, so two attempts for the same slot cannot both succeed.
- Idempotency keys make repeated submissions return the original booking instead of creating a duplicate.
- Status changes are transition-checked (`pending → confirmed/cancelled`, `confirmed → completed/cancelled/no_show`) and recorded in the audit trail.
- Rescheduling recalculates availability excluding the booking being moved.

### Dashboard

Routes are permission-guarded server-side, not only hidden in navigation.

- **Overview** — today, pending requests, next seven days, recent activity, attention items.
- **Calendar** — day and week views, therapist filter, time off.
- **Bookings** — search/filter list, detail, status changes, reschedule, history.
- **Clients** — directory, consent, spend/visits, detail, notes and message history.
- **Treatments** — create/edit, pricing, duration, buffers, add-ons, therapist assignment.
- **Team & hours** — profiles, weekly availability, time off, service assignment, studio opening hours.
- **Storefront** — theme presets/tokens, content, section order/visibility, saved draft, iframe preview, publish, version history and rollback.
- **AI assistant** — run tasks, inspect every tool step, review pending approvals, approve/reject, run history.
- **Marketing** — consent counts, campaign drafts, explicit send processing, per-recipient delivery status (`simulated` vs `sent`).
- **Settings** — business identity, timezone, location, opening hours, team roles, integration truth, runtime facts.
- **Platform admin** — `/admin`, restricted to `is_platform_admin`, shows tenants, record counts, subscriptions and audit events.

### AI assistant and approvals

- Provider abstraction with a deterministic **mock** provider (default) and an optional OpenAI provider (`AI_PROVIDER=openai`, `OPENAI_API_KEY`).
- Typed, tenant-scoped tools: business profile, booking summary, genuinely available slots, marketing audience, campaign history, storefront config. Tools never accept a tenant ID from the model.
- Workflows and steps are persisted with statuses `queued`, `running`, `awaiting_approval`, `completed`, `failed`, `cancelled`.
- Artifacts and approval requests are persisted. Approval payloads are bound to `hashPayload(payload)`; changing the payload after preparation causes a `409 payload_mismatch` and expires the request.
- Executing an approved campaign creates a real campaign and outbound message records, but marks them `simulated` unless Resend accepts them. Executing a copy refresh writes the **draft only**; publishing remains a separate human action.
- Owners and managers can decide approvals. Staff cannot.

### Multi-tenant isolation

- Every tenant-owned table carries `tenant_id`; queries filter by it.
- Dashboard tenant comes only from an authenticated session membership plus a validated tenant cookie (`nuru_dashboard_tenant`).
- `tenantId` is never accepted from client input for authorization.
- Public hostname/slug resolution only selects published storefront content.
- API routes use `requireApiPermission()` and re-check the tenant on every mutation.
- The platform admin page is separate from tenant membership and only exposes aggregate operational records.
- Integration tests exercise cross-tenant booking visibility, status updates, storefront writes and AI data.

### Security basics

- scrypt password hashing; random session tokens stored as SHA-256 hashes in the database.
- HTTP-only, SameSite=Lax session cookie; `Secure` in production.
- Same-origin checks on mutating API routes.
- Input validation with Zod; rate limiting on login, demo login, availability, booking and assistant runs (in-memory, per instance).
- Audit events for bookings, storefront publications, campaigns, approvals, agent runs and settings changes.

---

## Demo vs live integrations

| Capability | Demo default | Live path | Status |
| --- | --- | --- | --- |
| Database | Embedded PGlite | `DATABASE_URL` → PostgreSQL | Implemented |
| AI provider | Deterministic mock | `AI_PROVIDER=openai` + `OPENAI_API_KEY` | Implemented; no key in demo |
| Transactional/marketing email | Persisted as `simulated`, provider `demo` | `RESEND_API_KEY` + `EMAIL_FROM` | Implemented; not exercised without a key |
| Payments | Pay at appointment, no card data | — | **Not implemented** in the MVP |
| SMS / WhatsApp | Persisted as simulated if invoked | — | **No provider adapter**; UI/API do not claim delivery |
| Media storage | Bundled local files in `public/media` | S3 env vars reserved | **Upload/S3 adapter not implemented**; no upload UI |
| Calendar sync | Google Calendar link only | — | **Not implemented** |
| Billing/subscriptions | `tenant_subscriptions` demo rows | — | **Not implemented** |
| Background jobs | `scheduled_jobs` table exists | — | **No worker/cron** in the MVP |

The rule throughout: a status is only `sent` when a real provider accepts the message. With no provider, it is `simulated`, and the dashboard says so.

---

## Environment variables

See `.env.example` for the full contract.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | PostgreSQL connection string. Omit for local PGlite. |
| `SESSION_SECRET` | Production | At least 32 random bytes (`openssl rand -hex 32`). |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public base URL used in links/metadata. |
| `ROOT_DOMAIN` | Recommended | Tenant subdomains resolve as `<slug>.<ROOT_DOMAIN>`. |
| `DEMO_MODE` | Yes for demo | Enables demo sign-in, tenant switching, seeding and simulated external actions. |
| `DEMO_AUTO_LOGIN` | Demo only | When `DEMO_MODE=true`, acts as the workspace owner without a session. Defaults to the demo-mode value; **never enable with real data**. |
| `DEMO_AUTO_LOGIN_EMAIL` | No | Force a specific demo account (for example `owner@bahari.demo`) instead of the active tenant's owner. |
| `AI_PROVIDER` | No | `mock` (default) or `openai`. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | If OpenAI | Live model credentials. |
| `RESEND_API_KEY` / `EMAIL_FROM` | If live email | Real outbound email. |
| `STORAGE_PROVIDER` and `S3_*` | No | Reserved for a future media adapter. |
| `DATABASE_SSL=false` | No | Disable SSL for a local/private PostgreSQL. |

Production safety: `SESSION_SECRET` is checked when creating a session, and production should not use the development fallback. Set `DEMO_MODE=false` to disable demo sign-in, auto-login, demo switching, the demo tenant directory and seeding.

---

## Migrations and seed

```bash
npm run db:generate   # generate SQL after schema changes
npm run db:seed       # run migrations + seed if the database is empty
npm run db:studio     # Drizzle Studio (requires DATABASE_URL)
```

- Migration SQL lives in `drizzle/` and is applied automatically at startup by `ensureDb()` using the matching driver migrator.
- `npm run db:seed` calls the same bootstrap, then prints the tenants that exist. It does not duplicate data.
- Seed dates are relative to the day of seeding, so the demo calendar stays useful.
- To reset a local PGlite demo, stop the app and delete `.nuru/pgdata`, then restart.

---

## Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # production server
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint (Next.js core-web-vitals + TypeScript)
npm test            # Vitest (unit + integration)
npm run test:e2e    # Playwright (starts its own server on port 3100)
npm run verify      # lint + typecheck + tests + build
```

Playwright uses a fresh embedded database at `.nuru/e2e-pgdata` (deleted before the run) and a separate port, so it never touches your development demo data.

---

## Deploy to Render

A blueprint is included at `render.yaml`. The manual path:

1. Create a Render PostgreSQL instance and a Node web service from this repository.
2. Build command: `npm ci --include=dev && npm run build`; start command: `npm run start`; health check: `/api/health`.
3. Set:
   - `DATABASE_URL` from the Render database
   - `SESSION_SECRET` (generated)
   - `NODE_ENV=production`
   - `DEMO_MODE=true` for the demonstration deployment, `false` otherwise
   - `DEMO_AUTO_LOGIN=true` for a no-sign-in demo (demo only)
   - `NEXT_PUBLIC_APP_URL=https://<your-service>.onrender.com`
   - `ROOT_DOMAIN=<your-service>.onrender.com` or your custom domain
   - optionally `AI_PROVIDER`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`
4. Deploy. Migrations run on the first request; in demo mode the seed also runs when the database is empty.
5. Verify `/api/health` returns `{ "status": "ok" }`.

For branded tenant hostnames, add a wildcard custom domain (for example `*.nuru.example.com`) and set `ROOT_DOMAIN=nuru.example.com`. Render's shared `onrender.com` certificate does not cover arbitrary subdomains. Tenant domains are also stored in `tenant_domains`; hostname resolution is lookup-only and never authorizes dashboard access.

See [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md) for a checklist and troubleshooting.

---

## Tests

```bash
npm test
npm run test:e2e
```

Coverage includes:

- pure availability rules: closed days, therapist windows, buffers, time off, holds, lead time, cancellation, slot limits;
- booking creation, idempotency, a real concurrent race for one slot, status transitions and cross-tenant isolation;
- AI workflow persistence, approval payload hashing, tamper rejection, campaign execution, draft-only copy application, rejection and tenant scoping;
- storefront draft/publish/rollback/version history and invalid configuration;
- demo honesty: simulated messages, idempotent delivery and tenant isolation;
- role permissions;
- Playwright: storefront booking appearing in the dashboard, AI approval executed as simulated, storefront publish/rollback, demo tenant switching, and every dashboard/admin page rendering.

Results from the final local run are recorded in [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md).

---

## Documentation

- [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md) — a guided 10-minute demo.
- [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md) — Render deployment.
- [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) — commands and outcomes.
- [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) — what this MVP deliberately does not do.

---

## Known limitations

This is an MVP, not a finished commercial platform. Notably: no payment processing, no SMS/WhatsApp or S3 upload adapter, no calendar sync, no scheduled reminders or background worker, no billing/subscription management, no password reset or team invitation flow, and no live email test in this environment. Rate limiting is in-memory and therefore per instance. The storefront is a single curated page per tenant. See `docs/LIMITATIONS.md` for the full list.
