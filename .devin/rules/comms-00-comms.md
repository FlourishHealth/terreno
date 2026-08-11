---
trigger: glob
globs: 'comms/**/*.ts,comms/package.json'
---
# @terreno/comms

Backend-only communications plugin for Terreno apps. It defines provider contracts for mail, SMS,
push, and verification without adding concrete SendGrid, Twilio, or Expo SDKs to the core package.

## Commands

```bash
bun run comms:compile
bun run comms:lint
bun run comms:test
```

## Usage

```typescript
import {CommsApp, getCommsService} from "@terreno/comms";

new TerrenoApp({userModel: User}).register(new CommsApp({mail: mailProvider})).start();

await getCommsService().sendMail({
  subject: "Welcome",
  to: "person@example.com",
});
```

## Provider contracts

- `MailProvider.sendMail()` returns one `SendResult`.
- `SmsProvider.sendSms()` returns one `SendResult`.
- `PushProvider.sendPush()` returns one `SendResult` per token.
- `VerificationProvider` implements `startVerification()` and `checkVerification()`.
- Permanent push failures set `isPermanentFailure: true`; only those failures deactivate tokens.

Concrete providers belong in adapter subpath exports with optional peer dependencies. Never add a
provider SDK to core `dependencies`.

## Runtime behavior

- Unconfigured channels use privacy-safe console providers outside production.
- Unconfigured production channels throw a 501 `APIError`.
- Every provider attempt creates a `CommsMessage`; logging failure never breaks the send.
- Recipients are redacted at rest by default.
- Console logs contain counts and lengths only, never content, addresses, phone numbers, tokens, or
  verification codes.

## Routes

- `POST /comms/pushTokens`: authenticated, idempotent token registration.
- `GET /comms/pushTokens`: authenticated, restricted to the current user's tokens.
- `DELETE /comms/pushTokens/:id`: owner-only token deactivation.
- `GET /comms/messages`: admin-only, paginated delivery explorer.

An active push token cannot transfer between users. Its owner must deactivate it before another
user can register it.

## Testing

- Use the real `@terreno/test` Mongo preload; never mock models or `@terreno/api`.
- Use Supertest for route permissions and ownership boundaries.
- Keep provider fakes local to each test and mock only external provider/logging boundaries.
- Mutate environment keys narrowly and rely on the package preload reset contract.
- Use Chai `assert`.
