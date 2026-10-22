# Limitations

Nuru Wellness is a working MVP, not a finished commercial platform. This document lists what it deliberately does not do, so the demo and any handover do not overstate capability. The guiding rule is: **if it is not implemented, the product says so instead of faking success.**

## Payments and money

- No payment processing, deposits, card capture, refunds, invoices or receipts. Bookings are "pay at appointment"; no card data is collected or stored.
- No taxes, service charges, discounts, vouchers, gift cards or packages.
- No subscription billing. `tenant_subscriptions` exists as demo rows for the platform admin view only; there is no billing engine or plan enforcement.
- Prices are integer cents per service and are display/record only; changing a price does not rewrite historical bookings.

## Messaging

- Email is the only real outbound channel, and only when `RESEND_API_KEY` and `EMAIL_FROM` are set. Without them, messages are persisted with status `simulated` and provider `demo`.
- No SMS or WhatsApp provider adapter. Those channels are modelled in the schema and UI but are always simulated.
- No inbound email, replies, unsubscribe links, bounce handling or delivery webhooks.
- No automatic reminders, review requests or no-show follow-ups. `scheduled_jobs` exists as a table, but there is no worker or cron to process it.
- Campaign sending is explicit and synchronous per recipient. There is no queue, throttling, retry policy or scheduled send time.
- The confirmation page and dashboard show a message preview; it is not proof of delivery.

## AI assistant

- The default provider is a deterministic mock. It produces sensible, typed output for the four supported tasks, but it is not a language model and does not handle arbitrary open-ended requests.
- The optional OpenAI provider drafts text, but tool execution is still deterministic and restricted to the typed catalog. Model output is never trusted for tenant identity or authorization.
- Supported tasks: business question, schedule review, marketing campaign draft, storefront copy refresh. Other workflows (pricing changes, refunds, rebooking, staff edits) are not exposed to the agent.
- No streaming responses, conversation memory, file/image input, embeddings or retrieval. Each run is independent.
- Approval execution is single-step. There are no multi-approver policies, expiry notifications or delegated approvals. Expired/mismatched approvals must be re-prepared.
- The mock provider is intentionally labelled; a demo run is not evidence that a live model would behave identically.

## Booking engine

- Single-location booking flow in the UI. The schema has `locations`, but the storefront and booking flow use the primary location; there is no location picker or per-location service availability.
- One staff member per booking. No rooms/resources, equipment or combined-therapist sessions.
- No recurring appointments, waitlists, series bookings or calendar invites beyond a generated add-to-calendar link.
- No customer accounts, saved cards, self-service cancellation/reschedule links, or booking modification by the client. Changes are staff-initiated in the dashboard.
- Slot granularity is derived from service duration and availability; there is no configurable slot interval or "next available" optimization beyond the listed days.
- Timezone handling is per tenant, but daylight-saving transitions and travel-time buffers between locations are not modelled.
- Cancellation policy text is configurable content, not an enforced rule; no fees are calculated.

## Dashboard and operations

- No password reset, email verification, MFA, SSO/SAML, or team invitation flow. Users are seeded; adding a teammate requires database work in this MVP.
- `DEMO_AUTO_LOGIN` intentionally removes the authentication barrier for demonstrations: any visitor to a demo deployment acts as the workspace owner, and `/admin` acts as the platform admin. It is gated on `DEMO_MODE`, is not a production authentication strategy, and must be disabled before any real customer data is loaded.
- Roles are owner/manager/staff plus platform admin. There are no custom roles or per-resource grants.
- No bulk actions, CSV import/export, saved views, advanced reporting, revenue reports or analytics dashboards.
- No file uploads or media library. Storefront images are curated files bundled in `public/media`; `STORAGE_PROVIDER`/`S3_*` are reserved but there is no adapter or upload UI.
- The storefront is one curated page per tenant with fixed section types (hero, services, about, team, gallery, testimonials, location). No page builder, custom domains UI, blog, SEO editor per page, or multi-page storefront.
- Storefront version history keeps published snapshots; drafts are a single current draft, not branching drafts.
- Notifications exist as in-app records with a read marker; no push, desktop or digest delivery.
- Customer notes and message history are plain records; no attachments or rich text.

## Integrations

| Capability | Status |
| --- | --- |
| PostgreSQL | Implemented (`DATABASE_URL`); embedded PGlite fallback for local/demo |
| OpenAI text generation | Implemented behind `AI_PROVIDER=openai`; not exercised without a key |
| Resend email | Implemented; not exercised without a key |
| Payments | Not implemented |
| SMS / WhatsApp | No adapter; simulated only |
| Object storage / uploads | Not implemented |
| Google/Outlook calendar sync | Not implemented; link only |
| Accounting, CRM, Zapier/webhooks | Not implemented |
| Billing/subscriptions | Not implemented |
| Background jobs/cron | Not implemented |

## Security and operations

- Rate limiting is in-memory and per process. On multiple instances or serverless replicas it is not global. A shared store (for example Redis) is required before public exposure at scale.
- Session cookies are HTTP-only and database-backed, but there is no device/session management UI, forced logout, or suspicious-login alerting.
- Audit events cover the important mutations, but they are not tamper-evident (no hash chain or external log sink).
- No backup/restore automation in the app. Render's database backups (plan-dependent) are the operational safety net.
- No CSP header. Other baseline security headers are set in `next.config.ts`.
- PGlite is single-process and local-disk only; it is not a production multi-instance database. Always set `DATABASE_URL` in production.
- Demo mode creates known accounts with a published password and enables demo sign-in. It must never be enabled on a deployment holding real customer data.
- Errors are logged to stdout; there is no APM, tracing, metrics or alerting integration.
- `npm audit --omit=dev` reports a high-severity PostCSS advisory inherited from the Next.js 15 dependency tree (and one moderate item). The published fix currently requires a Next.js 16 major upgrade, which is out of scope for this MVP. Track it in the maintenance backlog and re-audit before a long-lived deployment.

## Testing and environment

- The build environment had no local PostgreSQL server or Docker daemon. Unit/integration tests and the demo use embedded PGlite, which is PostgreSQL-compatible but not byte-identical to every production PostgreSQL feature.
- Live OpenAI and Resend paths are implemented but not exercised here because no API keys were available. Treat them as untested integrations until verified with real credentials.
- Playwright runs one worker on a fresh database. It covers the main demo flows and page rendering, not exhaustive cross-browser or mobile-device matrices.
- No load, penetration, accessibility-certification or disaster-recovery testing has been performed. Basic keyboard/label semantics are present, but this is not an audited accessible product.
- Seed data is synthetic and relative to the day it is seeded; it is not suitable as production content.

## Product scope

- The product is designed for independent massage therapists and boutique spas. It is not a marketplace, does not list tenants publicly outside demo mode, and has no client-facing discovery or reviews.
- No multi-currency, multi-language or right-to-left support.
- No mobile app; the dashboard is responsive web only.
- No contract templates, waivers with e-signature, or medical intake forms beyond policy acceptance and consent flags.
- No inventory, retail products, memberships or loyalty points.

## What this means for a pilot

A pilot can safely use the booking engine, dashboard records, storefront publishing and AI drafts with human approval against a real PostgreSQL database. Before taking real money or promising message delivery, add payment and messaging providers, a background worker, shared rate limiting, backups, and live-provider verification.
