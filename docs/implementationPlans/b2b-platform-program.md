# Program: B2B platform

**Status:** Draft — roadmap items drafted; first IPs open; decisions D1–D7 pending
**Owner:** unassigned
**Created:** 2026-08-09

Umbrella plan coordinating the IPs that take Terreno from a single-tenant, per-user
full-stack kit to a framework you can spin up a B2B SaaS app with in hours. Pairs with the
roadmap items in
[roadmap-seed-issues.md](../explanation/roadmap-seed-issues.md) (B2B platform program
section).

## Goal

A freshly scaffolded, deployed Terreno app supports the B2B critical path out of the box:
**sign up → create an organization → invite a teammate → pick a plan → get an email.**
Today zero of those five steps are possible without custom code.

## Background

A capability audit (2026-08-08) found Terreno strong as a single-tenant CRUD + auth +
realtime + admin + AI kit, with three structural gaps for B2B SaaS: **tenancy** (no
orgs/teams/memberships), **money** (no billing), and **communication** (no email, SMS, or
push delivery — `expo-server-sdk` is an unused dependency and the RTK client's
`resetPassword` endpoint has no backend implementation). Supporting gaps: no invitations,
no durable jobs, no inbound-webhook framework, no rate limiting, no framework-level audit
log, no enterprise SSO/MFA, and missing B2B UI surfaces (server-filtered data grid, charts,
org switcher, dark mode).

## Tracks

| Track | Theme | IPs / roadmap items |
|---|---|---|
| A | Tenancy & access | `orgs-and-teams`, `rbac-permissions` (existing draft), `invitations-and-seats`, `org-management-ui` |
| C | Communications (pluggable) | `comms-abstraction`, one item **per adapter**: `comms-adapter-expo-push`, `comms-adapter-twilio-sms`, `comms-adapter-twilio-verify`, `comms-adapter-resend` (D2), `comms-adapter-twilio-push` (blocked on Twilio GA); consumers: `password-reset-and-email-verification`, `notification-center` |
| B | Billing | `inbound-webhooks`, `billing-stripe` (D1), `mobile-iap-revenuecat` (D1) |
| D | Zero-to-deployed DX | `create-terreno-app`, `mongo-migrations` (deploy items already exist in the OSS launch program) |
| E | B2B UI surfaces | `data-grid-server-filters`, `charts-and-dashboards`, `dark-mode-theme`, `command-palette`, `wizard-stepper`, `wysiwyg-editor` (D3), `global-search` |
| F | Enterprise & scale | `enterprise-sso`, `mfa-step-up-auth`, `framework-audit-log`, `rate-limiting`, `job-queues` |
| — | Native baseline | `native-module-baseline` — all new native modules land in one major release |

## Sequencing

1. **Foundations first:** `comms-abstraction` and `orgs-and-teams` are independent and both
   unblock most of the program. `inbound-webhooks` lands before billing and before comms
   delivery callbacks.
2. **Close the auth hole early:** `password-reset-and-email-verification` ships as soon as
   the abstraction plus one mail adapter exist — the client already calls `POST
   /resetPassword`.
3. **Billing after orgs + webhooks.**
4. **Native baseline rides the next major release** so every later feature ships as
   JS/OTA against the same binary.
5. Track E/F items are independent and can be scheduled opportunistically.

## Native module baseline (next major release)

Adding a native module to `@terreno/ui` or the example apps forces consumers to cut a new
dev-client/store build, so all additions land together in the next major:

| Package | Enables | Notes |
|---|---|---|
| `@stripe/stripe-react-native` | Billing (payment sheet, Apple/Google Pay) | Config plugin; Kotlin 2.x + compileSdk 36 via `expo-build-properties` |
| `react-native-purchases` (+ `-ui`) | Mobile IAP (RevenueCat) | Include even if the feature ships later (D1) — cheap now, a major release later |
| `expo-device` | Push registration guards | trivial |
| `expo-crypto` | PKCE for SSO, invite tokens | trivial |
| `expo-local-authentication` | Biometric step-up (MFA) | `NSFaceIDUsageDescription` |
| `expo-system-ui` | Dark mode root/system chrome | trivial |
| `@10play/tentap-editor` | WYSIWYG editor | **Only if D3 = adopt** |
| `react-native-otp-verify` | Android SMS OTP autofill | Optional (D7) |

Already linked, no action: skia, reanimated, gesture-handler, svg, webview,
expo-notifications, expo-secure-store, expo-document-picker/image-picker, blur,
permissions, expo-network. Charts (`victory-native`) is JS-only on existing peers.

## Decision log

Open decisions — each blocks the item(s) named:

| # | Decision | Options | Drafted default | Blocks |
|---|---|---|---|---|
| D1 | Billing vendor strategy | Stripe web-first + RevenueCat mobile later / RevenueCat-only / Stripe-only | Stripe first; RevenueCat item stays `Future`; `react-native-purchases` still ships in the native baseline | `billing-stripe`, `mobile-iap-revenuecat`, `native-module-baseline` |
| D2 | First mail adapter | Resend / SendGrid / SES / SMTP (and which others get adapters) | Resend first (modern API, minimal setup); others get items when requested | `comms-adapter-resend`, `password-reset-and-email-verification` |
| D3 | WYSIWYG editor | Adopt TenTap (native module → must be in the major manifest) / stay markdown-only | Markdown stays; TenTap item `Future` — **must be decided before the major is cut** | `wysiwyg-editor`, `native-module-baseline` |
| D4 | Twilio push adapter timing | Wait for Twilio Push API GA / join private beta now | Wait for GA (`status:blocked`) | `comms-adapter-twilio-push` |
| D5 | Target assignments | Confirm the Next vs Future split in the seed entries | As drafted | all items |
| D6 | Orgs data model | Native Terreno Mongoose models (works for JWT + Better Auth) / Better Auth `organization` plugin | Native models, optional Better Auth sync | `orgs-and-teams` |
| D7 | Final native manifest | Confirm package list incl. optional `react-native-otp-verify` | Six core packages + `react-native-purchases`; TenTap/otp-verify pending D3/D7 | `native-module-baseline` |

## IPs in this program

| IP | Status | Tasks |
|---|---|---|
| [comms-abstraction](comms-abstraction.md) | Draft | [tasks](../tasks/comms-abstraction.md) |
| [comms-adapter-expo-push](comms-adapter-expo-push.md) | Draft | [tasks](../tasks/comms-adapter-expo-push.md) |
| [comms-adapter-twilio-sms](comms-adapter-twilio-sms.md) | Draft | [tasks](../tasks/comms-adapter-twilio-sms.md) |
| [comms-adapter-twilio-verify](comms-adapter-twilio-verify.md) | Draft | [tasks](../tasks/comms-adapter-twilio-verify.md) |
| [orgs-and-teams](orgs-and-teams.md) | Draft | [tasks](../tasks/orgs-and-teams.md) |
| [rbac-permissions](rbac-permissions.md) | Draft (pre-existing API design) | TBD |

Remaining items get IPs as they approach the top of the queue; adapter IPs blocked on
decisions (D1–D4) are written once the decision lands.

## Not Included

- Deploy guides and deployment foundation (OSS launch program).
- `@terreno/syncdb` migration work (PR #869 track).
- Marketing/positioning for the B2B pitch.
