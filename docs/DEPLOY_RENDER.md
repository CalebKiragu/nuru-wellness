# Deploying to Render

This project targets Render with a Node web service and a managed PostgreSQL database. The included `render.yaml` blueprint describes both. Migrations run automatically on the first request; in demo mode the seed also runs when the database is empty.

> Production should always set `DATABASE_URL`. Without it the app falls back to embedded PGlite on local disk, which is only appropriate for a single-instance demo or local development and does not survive a deploy.

## 1. Prerequisites

- A Render account and this repository pushed to GitHub/GitLab.
- Node.js 20+ locally (built and tested on Node 24; Next.js 15 requires 18.18+). Set `NODE_VERSION=24` on Render if the default differs.
- A generated session secret: `openssl rand -hex 32`.

## 2. Blueprint deployment (recommended)

1. In Render, choose **New → Blueprint** and connect the repository.
2. Render reads `render.yaml` and proposes:
   - web service `nuru-wellness` — `npm ci --include=dev && npm run build`, start `npm run start`, health check `/api/health`;
   - PostgreSQL database `nuru-db`.
3. Apply the blueprint. `SESSION_SECRET` is generated automatically and `DATABASE_URL` is injected from the database.
4. After the first deploy, open the service URL. The first request runs migrations and — with `DEMO_MODE=true` — seeds both studios.
5. Check `https://<service>.onrender.com/api/health`:

   ```json
   { "status": "ok", "database": "ok", "databaseName": "nuru", "demoMode": true, "autoLogin": true, "aiProvider": "mock", "timestamp": "..." }
   ```

6. Replace the placeholder `NEXT_PUBLIC_APP_URL` and `ROOT_DOMAIN` values from `render.yaml` with the real hostname Render assigned, then redeploy.

## 3. Manual deployment

Create a **PostgreSQL** instance first, then a **Web Service**:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm run start` |
| Health check path | `/api/health` |
| Auto-deploy | On commit (optional) |

Environment variables:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Internal connection string from the Render database. |
| `SESSION_SECRET` | Yes | At least 32 random bytes. Do not reuse the development fallback. |
| `NODE_ENV` | Yes | `production`. |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://<service>.onrender.com` or custom domain. Used in metadata and links. |
| `ROOT_DOMAIN` | Recommended | `<service>.onrender.com` or your custom root domain. |
| `DEMO_MODE` | Demo only | `true` enables demo sign-in, tenant switching, the demo directory and seeding. Use `false` for a real customer deployment. |
| `DEMO_AUTO_LOGIN` | Demo only | Requires `DEMO_MODE=true`. Acts as the workspace owner without a session so the demo needs no sign-in. **Never enable on a deployment with real data.** |
| `DEMO_AUTO_LOGIN_EMAIL` | No | Force a specific demo account instead of the active tenant's owner. |
| `AI_PROVIDER` | No | `mock` (default) or `openai`. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | If OpenAI | Live model credentials. |
| `RESEND_API_KEY` / `EMAIL_FROM` | If live email | Real outbound email. Without these, sends are `simulated`. |
| `DATABASE_SSL` | No | Set `false` only for a local/private PostgreSQL without SSL. Render's internal URL works with SSL. |
| `LOG_LEVEL` | No | `info` by default. |

`DATABASE_URL` may use `postgres://` or `postgresql://`; the app passes it to `node-postgres`. If the URL includes `sslmode=require`, SSL is enabled.

## 4. Custom domains and tenant hostnames

The storefront resolves a tenant from the request hostname (plus the demo-switch cookie in demo mode). Dashboard access never depends on the hostname.

- **Single host:** keep everything on `<service>.onrender.com`. Tenants are still reachable via the demo switch, and the dashboard works from the same host.
- **Branded subdomains:** add a wildcard custom domain such as `*.nuru.example.com` to the web service, then set `ROOT_DOMAIN=nuru.example.com`. Add DNS records as instructed by Render.
- **Render's `onrender.com` certificate does not cover arbitrary subdomains.** `amani.nuru-wellness.onrender.com` will not have a valid certificate unless you own and verify the domain.
- Custom tenant hostnames can also be stored in `tenant_domains`; resolution is lookup-only and is never used for authorization.

## 5. Migrations and seed behaviour

- On the first request, `ensureDb()` opens the connection pool and applies the SQL in `drizzle/` with the driver's migrator.
- If `DEMO_MODE=true` and no tenants exist, the two demo studios are seeded once. Restarting does not duplicate data.
- To seed a fresh production database deliberately:

  ```bash
  DATABASE_URL=postgres://... npm run db:seed
  ```

- To reset a demo deployment, drop and recreate the Render database, then restart the service. There is no in-app reset endpoint.
- Schema changes: run `npm run db:generate`, commit the new SQL in `drizzle/`, and deploy. Never edit an applied migration in place.

## 6. Post-deploy smoke test

1. `GET /api/health` returns `status: ok`.
2. Landing page lists the two demo studios (only when `DEMO_MODE=true`).
3. Open a storefront, create a booking, and confirm a reference is shown.
4. Sign in as `owner@amani.demo` / `NuruDemo2026!` and find the booking in **Bookings**.
5. Open **Assistant**, approve the seeded campaign, and confirm the result says **simulated**.
6. Publish a storefront change and restore version 1.
7. Sign in as `admin@nuru.demo` and open `/admin`.

## 7. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Health check returns 503 | Database unreachable. Check `DATABASE_URL`, database status, and whether SSL is required. |
| Build fails with `@electric-sql/pglite` | PGlite is listed in `serverExternalPackages`. Keep that setting; it must not be bundled by the server compiler. |
| `SESSION_SECRET must be set` in production | Add a real secret. The development fallback is refused when `NODE_ENV=production`. |
| Storefront shows the platform landing | Hostname is not mapped to a tenant and no demo cookie is set. Use the demo switch or a `<slug>.<ROOT_DOMAIN>` host. |
| Demo sign-in buttons missing | `DEMO_MODE` is not `true`, or the deployment is a non-demo environment. |
| Emails show `simulated` | Expected without `RESEND_API_KEY`/`EMAIL_FROM`. This is deliberate and is not an error. |
| Seed did not run | The database already contains tenants, or `DEMO_MODE=false`. Run `npm run db:seed` manually if appropriate. |
| Free instance sleeps and first request is slow | Render free/starter instances spin down. The first request also runs migrations. Health checks can keep the service warm. |

## 8. Operational notes and caveats

- Rate limiting is in-memory and per instance. With multiple instances, put a shared limiter (Redis/Upstash) in front before exposing sensitive endpoints publicly.
- Sessions are database-backed; horizontal scaling works without sticky sessions.
- Background jobs, reminders and campaign scheduling have no worker. Sending is explicit and synchronous.
- Media is bundled in `public/media`; there is no upload or S3 adapter yet. Do not promise customer uploads.
- The demo seed creates known accounts with a published password. Demo mode can also auto-login as an owner. Never enable `DEMO_MODE`/`DEMO_AUTO_LOGIN` on a deployment holding real customer data.
- Logs go to stdout/stderr and are available in Render's log stream. Health checks log failures with `health_check_failed`.

## 9. Rolling back

- **Application:** use Render's deploy history to roll back to a previous image. Database migrations are forward-only; do not roll back the app across a destructive schema change without a database backup.
- **Storefront content:** use the dashboard's version history and restore.
- **Demo data:** recreate the database and let the seed run.
