# Demo walkthrough

A guided ten-minute tour of Nuru Wellness. The demo is designed to be run from a single browser on a laptop, with the public storefront and the dashboard in separate tabs.

> **What is real:** storefront content, services, staff, availability, bookings, customers, campaigns and audit history are read from and written to the database. Dashboard changes persist.
>
> **What is simulated:** outbound email/SMS, payments and media uploads. The UI labels these as `Simulated · not sent`, `demo` or `not configured`. Never present a simulated send as delivered.

## Before you start

```bash
npm install
cp .env.example .env.local     # DEMO_MODE=true is already set
npm run dev
```

First request runs migrations and seeds the two demo studios if the database is empty. If you have an old database and want the current seed data:

```bash
# stop the dev server first
rm -rf .nuru/pgdata
npm run dev
```

Open <http://localhost:3000>. Without a tenant hostname you get the demo landing page with two studio cards. Tenant hostnames also work directly:

- Amani Bodywork — <http://amani.localhost:3000>
- Bahari House — <http://bahari.localhost:3000>
- Dashboard login — <http://localhost:3000/login>
- Platform admin — <http://localhost:3000/admin> (after signing in as the platform admin)

All seeded accounts use the password **`NuruDemo2026!`**. In demo mode the login page also has one-click buttons for the owner accounts and the platform admin.

| Account | Role | Workspace |
| --- | --- | --- |
| `owner@amani.demo` | Owner | Amani Bodywork |
| `manager@amani.demo` | Manager | Amani Bodywork |
| `staff@amani.demo` | Staff | Amani Bodywork |
| `owner@bahari.demo` | Owner | Bahari House |
| `staff@bahari.demo` | Staff | Bahari House |
| `admin@nuru.demo` | Platform admin | `/admin` |

---

## 1. Two brands, one platform (1 min)

1. On the landing page, open **Amani Bodywork** → *View storefront*.
2. Point out the editorial layout, botanical palette, studio story, team and booking calls to action.
3. Go back and open **Bahari House**.

**Talking point:** same codebase, different tenant theme, content, services, staff and domain. Nothing about the visual identity is hard-coded per customer. The storefront is resolved from the hostname; the dashboard is never authorized by the hostname.

**Isolation proof (optional, 30 s):** sign in as `owner@bahari.demo` in a private window and try to open an Amani booking URL copied from the Amani dashboard. It returns not-found — tenant ownership is checked on the server, not by the URL.

## 2. Book like a client (2 min)

1. On Amani, open **Deep Tissue Reset** (or *Book a treatment*).
2. Pick a therapist, then a date. Availability is loaded from the server; closed days are disabled and each open day loads only genuine free slots.
3. Choose a time, add an add-on if you like, and continue.
4. Enter a name, email, phone, accept the policy, review, and confirm. No account is created.

The confirmation page shows:

- a real reference such as `AMA-7K2M9Q`;
- the appointment summary and add to-calendar link;
- a **Simulated · not sent** message preview, clearly labelled as demo behaviour.

**Talking point:** slots are computed server-side from opening hours, therapist availability, buffers, time off, holds and existing bookings. Creation revalidates availability inside a transaction under an advisory lock, so the same slot cannot be double-booked. Repeated submissions with the same idempotency key return the original booking.

## 3. See it land in the business (1 min)

1. Open `/dashboard` directly. With `DEMO_AUTO_LOGIN=true` the demo signs you in as **Amani Bodywork · Owner** without credentials; a banner confirms auto-login is active.
2. Open **Bookings** and search for the reference from step 2.
3. Open the booking. Change the status to *confirmed* or reschedule it to another open slot.
4. Open **Calendar** and switch between day and week views, filtering by therapist.

**Talking point:** the client booking and the business record are the same row, with an audit trail for status and schedule changes.

> If you want to demonstrate roles, open `/login` and use the one-click owner, manager, staff or platform-admin buttons. Those still create real sessions. Opening `/admin` directly auto-signs in as the platform admin in demo mode.

## 4. Let the assistant prepare work (2 min)

1. Open **Assistant**.
2. The seeded workspace already has a pending approval: *Send marketing campaign — “Make room this week”*.
3. Expand the approval to show the subject, body, audience count and rationale.
4. Point out the tool steps above: available slots, business profile, campaign draft. The assistant read only this tenant's data.
5. Approve it. Confirm the dialog. The result is recorded as **simulated**; the campaign appears under **Marketing** with per-recipient `simulated` delivery status.
6. Optionally run a new task, for example *Refresh storefront copy*. It prepares a draft and waits for approval. Approving writes the **draft only** — you still publish manually.

**Talking point:** the agent cannot send, publish, delete or charge without a human. Approvals are bound to a hash of the prepared payload; if the payload changes after preparation, execution is rejected with `409 payload_mismatch`. Demo sends never claim delivery.

## 5. Edit and publish the storefront (2 min)

1. Open **Storefront**.
2. Change the headline or introduction under **Content**, adjust a theme token if you like, and reorder or hide a section.
3. Use **Preview** to check the iframe, then **Preview & publish** → **Publish live**.
4. Open the storefront in a new tab: the change is live and the previous version is in history.
5. Press **Restore** on version 1. A new publication is created from the old version — history is never rewritten.

**Talking point:** draft, preview, publish and rollback are separate states. Publishing snapshots the whole configuration into a version row. Rolling back is itself a publish, so the audit trail stays append-only.

## 6. The business controls (1 min)

- **Overview** — today, pending requests, next seven days and attention items.
- **Clients** — contact details, consent, visits/spend, notes and message history.
- **Treatments** — price, duration, buffers, add-ons and therapist assignment.
- **Team & hours** — weekly availability, time off, service assignment and studio opening hours.
- **Marketing** — consent counts, campaign drafts, explicit send, per-recipient status.
- **Settings** — identity, timezone, location, opening hours, roles and the integration truth table.
- **Platform admin** — `/admin` shows both tenants and aggregate record counts. It is only available to `admin@nuru.demo` and is separate from tenant membership.

## 7. Close with the honesty slide (30 s)

Open **Settings → Integrations** and the README integration table. The same story everywhere:

| Capability | Demo behaviour |
| --- | --- |
| Database | Real PostgreSQL (Render) or embedded PGlite (local) |
| AI | Deterministic mock by default; OpenAI optional with a key |
| Email | Persisted and labelled `simulated` unless Resend accepts it |
| Payments | Not implemented — pay at appointment, no card data |
| SMS/WhatsApp | No adapter; never shown as delivered |
| Media uploads | Bundled local media; no upload UI |
| Calendar sync | Download/link only |
| Billing, background jobs | Not implemented in this MVP |

## Reset between demos

```bash
# stop the dev server
rm -rf .nuru/pgdata
npm run dev
```

The seed is relative to the day it runs, so the calendar, pending approval and “this week” copy stay current. Deleting the demo database is the supported reset; there is no in-app destructive reset button.

## If something looks wrong

| Symptom | Check |
| --- | --- |
| Landing page shows no studios | `DEMO_MODE=true` in `.env.local`, and the database has been seeded |
| `amani.localhost` does not resolve | Use the landing-page switch, or add `127.0.0.1 amani.localhost bahari.localhost` to `/etc/hosts` |
| No availability | The seed day may be a closed day; move forward a day or reseed |
| Login says invalid credentials | Password is `NuruDemo2026!`; demo sign-in buttons require `DEMO_MODE=true` |
| Approval button is missing | Only owners and managers can decide approvals; staff cannot |
| Emails show `simulated` | Expected without `RESEND_API_KEY`; this is the honest demo state |
