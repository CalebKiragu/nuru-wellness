# Test results

Final local gate for this delivery, run on **22 October 2026**. Every command below was executed in the repository root; outcomes are copied from the final run, not projected.

## Environment

| Item | Value |
| --- | --- |
| OS | Linux 7.0.0-38-generic |
| Node | v24.22.0 |
| npm | 11.19.1 |
| Next.js | 15.5.28 |
| React | 19.1.10 |
| Database driver | embedded PGlite 0.5.11 (no PostgreSQL server in this environment) |
| Vitest | 5.0.5 |
| ESLint | 9.39.1 (`eslint-config-next` 15.5.28) |
| Playwright | 1.64.1 |
| Browser | Chromium (Desktop Chrome) |

## Summary

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | **Pass** — 0 errors, 0 warnings |
| Type check | `npm run typecheck` | **Pass** — no TypeScript errors |
| Unit / integration | `npm test` | **Pass** — 6 files, 39 tests, 23.81 s |
| Production build | `npm run build` | **Pass** — compiled in 9.7 s, 52 routes, 23 pages generated |
| End-to-end | `npm run test:e2e` | **Pass** — 6 tests, 3.2 min |
| Combined gate | `npm run verify` | **Pass** — lint + typecheck + tests + build (exit 0) |

`npm run verify` runs ESLint, typecheck, Vitest and the production build. Playwright is run separately because it starts its own development server on port 3100 and a fresh database at `.nuru/e2e-pgdata`.

## Lint

```
> eslint .
(no output)
```

ESLint uses the Next.js `core-web-vitals` and TypeScript configs with the flat config in `eslint.config.mjs`. Generated output, migrations and `next-env.d.ts` are ignored. The run reports no errors and no warnings.

## Unit and integration tests (`npm test`)

```
Test Files  6 passed (6)
     Tests  39 passed (39)
  Duration  23.81s (tests 64%, import 35%, transform 1%)
```

| Suite | Tests | What it proves |
| --- | ---: | --- |
| `tests/availability.test.ts` | 9 | Slots stay inside business **and** therapist hours; closed days return nothing; buffers, time off, holds and cancelled bookings are handled; lead time; full service plus buffers must fit; multiple staff windows merge and respect `maxSlots`; weekday calculation has no timezone drift. |
| `tests/bookings.test.ts` | 7 | A genuine slot creates a tenant-scoped confirmed booking; repeated idempotency keys return the original; a taken slot is rejected; **two concurrent attempts for one slot produce exactly one winner**; bookings and status changes are isolated by tenant; mixed-tenant service/staff input is refused; status transitions are enforced. |
| `tests/ai-approvals.test.ts` | 6 | A run persists `queued → awaiting_approval` with a hash-bound payload; tampering after preparation is rejected; an approved campaign executes as **simulated** and never claims delivery; an approved copy refresh changes the **draft only**; rejection has no side effects; runs, approvals and tool facts are tenant-scoped. |
| `tests/storefront.test.ts` | 6 | Draft saves do not change the live site; publishing creates an immutable snapshot and increments the version; rollback creates a new version instead of deleting history; invalid configuration and a cross-tenant version are rejected; one tenant’s save cannot affect another; hostname normalisation strips ports/casing/trailing dots and never performs a membership lookup. |
| `tests/demo-honesty.test.ts` | 6 | With no email provider a message is `simulated`; simulated messages do not leak across tenants; owner/manager/staff permission sets are correct; role labels are correct. |
| `tests/url.test.ts` | 5 | Redirects reconstruct the visitor-facing origin from proxy headers instead of Render's internal `localhost:10000`; protocol-relative targets are rejected; same-origin checks accept proxied requests and reject foreign origins. |

Database-backed suites create an isolated PGlite database per test file via `tests/helpers/database.ts`, apply the real migrations, and exercise the same service functions as the HTTP routes. `server-only` is aliased to a test stub in `vitest.config.mts`.

## End-to-end tests (`npm run test:e2e`)

```
✓ 1  demo auto-login opens each workspace and admin without credentials (13.2s)
✓ 2  a public booking appears immediately in the dashboard (36.9s)
✓ 3  a seeded AI approval is reviewed and executed as simulated (17.5s)
✓ 4  storefront edits publish and roll back without losing history (33.5s)
✓ 5  demo tenants switch as separate branded storefronts (17.9s)
✓ 6  every dashboard page and the platform admin render for an owner (54.0s)

6 passed (3.2m)
```

The runner deletes `.nuru/e2e-pgdata` before starting, boots `next dev` on port 3100, waits for `/api/health`, and runs serially (`workers: 1`) so seeded state is deterministic.

What the flows verify:

1. `DEMO_AUTO_LOGIN` opens the Amani dashboard, the Bahari dashboard and `/admin` without a session, and each shows the correct workspace or platform identity.
2. A real public booking on `amani.localhost` creates `AMA-…`, shows **Booking confirmed** and a **Simulated · not sent** message, then appears in the owner’s dashboard search.
3. The seeded pending campaign approval can be approved; the result is labelled simulated and the campaign appears under Marketing with simulated delivery.
4. Editing storefront content, publishing, and restoring version 1 works; the restored public headline is verified on the storefront.
5. Demo switching resolves two separate branded storefronts; Bahari does not show Amani’s headline.
6. All eleven dashboard routes return HTTP 200 with a visible heading and no application error, and the platform admin page renders both tenants.

Playwright retains traces and screenshots only on failure; the final run produced none.

## Responsive and motion QA

Manual Chromium checks via Playwright, in addition to the automated suite:

| Check | Result |
| --- | --- |
| Desktop landing at 1440×1000 | **Pass** — hero, marquee, studio cards, AI panel and closing CTA render after reveals |
| Mobile landing at 390×844 | **Pass** — no horizontal overflow; header collapses to a single demo CTA |
| Mobile Amani storefront at 390×844 | **Pass** — no horizontal overflow; hero, gallery and booking CTA remain usable |
| `prefers-reduced-motion: reduce` | **Pass** — reveal content is immediately visible, ambient/ken-burns loops are disabled, and the hero is not left at `opacity: 0` |
| Browser console | **Pass** — no application errors or hydration warnings on the checked pages |

The reveal component renders identical markup on the server and client (visibility is applied after hydration), so reduced-motion and no-JavaScript visitors never receive hidden content. The root layout includes a `<noscript>` rule as a final fallback.

## Production smoke test (Render)

Deployed at **<https://nuru-wellness.onrender.com>** on 22 October 2026 (free web service, Oregon; PostgreSQL database `nuru`).

| Check | Result |
| --- | --- |
| `GET /api/health` | **200** — `status: ok`, `database: ok`, database name `nuru`, `demoMode: true` |
| `GET /dashboard` with no cookie | **200** — auto-login banner and Amani workspace visible |
| `GET /admin` with no cookie | **200** — platform overview visible |
| `POST /api/auth/login` with a seeded owner | **200** — confirms `SESSION_SECRET` is configured and real sessions still work |
| Demo switch to Bahari, then `/dashboard` | **200** — Bahari House visible with auto-login |
| Bahari storefront via demo cookie | **200** — Bahari headline rendered |
| `GET /dashboard/bookings` with no cookie | **200** |
| `POST /api/demo/switch` behind Render's proxy | **303** — `Location: https://nuru-wellness.onrender.com/`, no `localhost:10000` |
| `POST /api/auth/logout` behind Render's proxy | **303** — `Location: https://nuru-wellness.onrender.com/` |
| Landing HTML scan | **Pass** — no `localhost:10000` in delivered links |
| Playwright click on **View storefront** | **Pass** — navigates to the public host and renders the selected studio |
| Storefront and dashboard after a live demo switch | **Pass** — Bahari storefront and dashboard return 200 with no console errors |
| `.github/workflows/keep-alive.yml` short-loop run | **Pass** — 2m38s; woke the cold instance, dispatched a successor with HTTP 204, and the successor started immediately |
| `.github/workflows/keep-alive.yml` scheduled cron observation | **Limited** — GitHub fired the five-minute schedule only three times in fourteen hours (23:53, 02:23 and 07:45 UTC). The workflow now self-dispatches a 5h40m loop; the five-minute schedule is a recovery net, not the primary mechanism. |

The live database was migrated and seeded automatically on the first request. These checks confirm the deployed environment, not a local substitute.

## Build

- `next build` compiled successfully in 9.7 s.
- 52 application routes were emitted (public pages, dashboard pages, preview, and API handlers).
- First Load JS shared by all: 103 kB.
- The build's own type check and page-data collection completed without errors.
- `@electric-sql/pglite` is kept as a server external package; it is not bundled into client output.

## Non-blocking warnings

- Next.js prints the standard “Experiments (use with caution): serverActions” banner because `experimental.serverActions.bodySizeLimit` is set.
- No live OpenAI or Resend key was available, so those provider paths were not exercised. Demo sends were verified to remain `simulated`. This is recorded in `docs/LIMITATIONS.md`.
- `npm audit --omit=dev` reports two production-dependency advisories (one high, one moderate) in the PostCSS version bundled with Next.js 15. The available fix is a Next.js 16 major upgrade; it is logged in `docs/LIMITATIONS.md` rather than applied silently.

## What was **not** run

- No load, soak, penetration or accessibility certification testing.
- No cross-browser matrix beyond Chromium; no real mobile device testing.
- No live PostgreSQL instance (PGlite only), no live OpenAI call and no live Resend delivery.
- No load, soak or penetration testing of the keep-alive workflow; it is a demo availability convenience, not a production SLA mechanism.
- The keep-alive loop intentionally holds one long GitHub Actions job (~5h40m) per handoff. It is bounded to the demo window and uses free runner minutes on this public repository; it is not a production availability pattern.
- GitHub Actions' `schedule` trigger is best-effort and was observed running hours late. The self-dispatch handoff, not the cron entry, is what keeps the demo warm.

These gaps are intentional for the MVP and are documented in [`LIMITATIONS.md`](LIMITATIONS.md).

## Reproducing

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

For a clean e2e run the Playwright config removes `.nuru/e2e-pgdata` itself. For the local demo, stop the server and remove `.nuru/pgdata` to reseed.
