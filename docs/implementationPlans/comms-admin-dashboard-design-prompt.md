# Claude Design prompt: Comms admin dashboard

Paste the block below into Claude Design (claude.ai). It specifies Terreno admin chrome and `@terreno/ui` so the output can go through `design-blend`.

Source IP: [`comms-admin-dashboard.md`](comms-admin-dashboard.md)

---

```
Design a staff-only operations dashboard for Terreno, a TypeScript full-stack framework (Django/Rails analog) with a React Native Web admin panel.

This is NOT a marketing site, NOT a consumer inbox, and NOT a Twilio/SendGrid console clone. It is an internal admin tool for on-call engineers and ops to see delivery health, filter logs, inspect a single send, and retry failures.

Match existing Terreno Admin UI v2 chrome:
- Desktop: left sidebar ~280px, brand teal (#2B6072) "colorful" rail, light nav labels, white top bar with breadcrumbs, main canvas color ~neutral-050.
- Content column: padding 24px 28px 80px, max-width 1280px.
- Page sits on a transparent canvas (no second nested app chrome).
- Typography: UI sans (Nunito-like body, Titillium-like headings). Tight, dense, operational — not airy SaaS marketing.
- Mobile (<768px): hamburger + drawer; stack filters; table becomes a horizontally scrollable dense table, not a card list of everything.
- Use a real design system look: 4/8px spacing, 4–8px radii, subtle borders, no drop-shadow carnival, no gradients, no 3D, no illustrations.

Product
- Admins operate email / SMS / push / verification sends across providers (SendGrid, Twilio, Expo, console).
- Recipients are PII: show redacted destinations (email local-part masked, phone last-4 only, e.g. j***@clinic.org, ••••1234). Never full addresses, message bodies in the table, or verification codes.
- Retry creates a NEW delivery row linked to the original. Original is not overwritten.
- Permanent failures, expired payloads, unconfigured channels, and the verification channel are not retryable. Show a disabled control with the reason.
- Filters are server-side and persist in the URL (shareable views). Default date range: last 7 days.
- Bulk retry uses the current filters, cap 100 per action, with an explicit confirmation of the count.

Do not design
- Charts / graphs (count cards only; charts come later).
- Compose / send-new-message / campaign tools.
- End-user notification history.
- Settings for providers, templates, or webhooks.
- Dark mode.
- A new visual language that diverges from the admin shell.

Screens (every state listed)

1) Comms — list / dashboard  (nav item: "Comms")
   Layout top → bottom:
   a. Page title "Comms" + short subtitle "Delivery logs and retries".
   b. Primary action: "Retry filtered failures" (outline/secondary; disabled when filtered failed+bounced count is 0).
   c. Stats row: four Cards — Sent, Delivered, Failed, Bounced — plus per-provider failure-rate chips. If any provider failure rate > 5%, that chip and/or a Failed card uses error/danger color. No charts.
   d. Filter bar in one wrap row (desktop) / stacked (mobile):
      Select: Channel (all | mail | sms | push | verification)
      Select: Provider (all | sendgrid | twilio | expo | console)
      Select: Status (all | sent | delivered | failed | bounced | cancelled)
      Select: Error class (all | transient | permanent | config)
      Text search: placeholder "Subject, error, or last-4 of recipient"
      Date range: start + end
      Clear filters (ghost, only when dirty)
   e. Data table columns: Created · Channel · Provider · To (redacted) · Subject / preview · Status (badge) · Error code · Attempts · (icon-only Retry)
      Row click opens detail. Retry icon only on retryable rows; otherwise omit or show disabled with tooltip.
   f. Pagination at the bottom.

   Required states for screen 1 (separate frames):
   - Default 7-day view, mixed healthy data, ~12 rows, failure rate under 5%.
   - Incident view: failure rate 18% on twilio, Failed card in error color, several failed SMS rows, Retry icons visible.
   - Filters applied + empty: "No deliveries match these filters" with Clear filters.
   - Loading: spinner over table, stats as skeleton/placeholder cards.
   - Error: banner "Could not load delivery logs" + retry.

   Status badge colors:
   - delivered = success/green
   - sent = neutral/info
   - failed = error/red
   - bounced = warning/orange
   - cancelled = muted

2) Comms — message detail  (breadcrumb: Admin / Comms / Message)
   Layout:
   a. Back link "All deliveries".
   b. Header row: status badge, channel + provider, redacted To, created/last-attempt timestamps.
   c. Meta: linked User (name + email as a text link, not an avatar hero), template id if present, retried-from / retried-by as text links to other messages.
   d. Primary button "Retry send" with confirmation. Disabled + tooltip when not retryable. Reasons to show: "Permanent failure", "Payload expired", "Channel not configured", "Verification codes cannot be retried".
   e. Attempt timeline (vertical, oldest at top): each attempt shows time, provider, provider message id as an external-link style, error code + one-line error. Success attempts look quiet; failed attempts use error text color.
   f. Two collapsed accordions: "Retained payload (redacted)" and "Provider metadata". Expanded state shows a monospace JSON block. Payload must look redacted (no raw email/phone/code).
   g. If this message was itself a retry, a small banner: "Retry of {short id}" with link.

   Required states for screen 2 (separate frames):
   - Retryable failed SMS (transient). Enabled Retry. 2 attempts, second failed with Twilio 30005.
   - Permanent bounce (mail). Disabled Retry, tooltip "Permanent failure".
   - Verification channel. Disabled Retry, tooltip "Verification codes cannot be retried".
   - Successful retry result: status delivered, banner linking back to original, no Retry (already delivered).

3) Confirm bulk retry  (modal on top of incident list)
   Title: "Retry filtered failures?"
   Body: "This will retry up to 100 failed or bounced deliveries matching the current filters (42 match). Permanent failures, expired payloads, and verification messages will be skipped."
   Primary: destructive/warning-tinted "Retry 42" — actually use primary button, not a delete red, because this is a repair action.
   Secondary: Cancel.
   Do not invent a progress theater; one confirm, then return to the list.

Visual references to emulate (structure, not brand copy)
- Linear issue list density + filter chips.
- Stripe Dashboard logs: filters + table + right-or-full detail, not a three-pane email client.
- Sibling in this product: AI Request Explorer (title, date filters, table, pagination) — extend that pattern with stats cards and a detail page.

Annotated on the frames
- Label each region with the intended @terreno/ui building block: Page, Box, Card, Heading, Text, SelectField, TextField, DateTimeField, DataTable, Badge, Button, IconButton, Accordion, Modal, Spinner, Banner, Pagination.
- Mark testIDs conceptually: comms-dashboard, comms-stats, comms-filters, comms-table, comms-retry, comms-detail, comms-attempts, comms-payload, comms-bulk-retry.

Deliverable
- Desktop (1280) and mobile (390) for the default list, the incident list, one retryable detail, one disabled-retry detail, and the bulk-retry modal.
- Use realistic fake data (clinic names, Twilio-looking error codes, SendGrid message ids). Keep PII redacted.
```
