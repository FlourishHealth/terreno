# @terreno/comms

Provider-agnostic transactional communications for Terreno backends. The core package defines
mail, SMS, push, and verification contracts without installing SendGrid, Twilio, or Expo SDKs.

## Install

```bash
bun add @terreno/comms
```

Peer dependency: `mongoose ^8.0.0 || ^9.0.0`.

## Register the plugin

```typescript
import {
  CommsApp,
  ConsoleMailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
} from "@terreno/comms";
import {TerrenoApp} from "@terreno/api";

new TerrenoApp({userModel: User})
  .register(
    new CommsApp({
      defaultFrom: "notifications@example.com",
      mail: new ConsoleMailProvider(),
      push: new ConsolePushProvider(),
      sms: new ConsoleSmsProvider(),
      verification: new ConsoleVerificationProvider(),
    })
  )
  .start();
```

Console providers log only non-sensitive metadata such as message lengths and recipient counts.
They never log message content, recipient identifiers, push tokens, or verification codes.

## Send messages

Use the registered service from routes, jobs, or other plugins:

```typescript
import {getCommsService} from "@terreno/comms";

await getCommsService().sendMail({
  subject: "Welcome",
  text: "Thanks for joining.",
  to: "person@example.com",
});

await getCommsService().sendSms({
  body: "Your appointment is tomorrow.",
  to: "+15555550100",
});
```

`sendPushToUser()` resolves active device tokens and deactivates tokens only when a provider marks
a failure as permanent. `startVerification()` and `checkVerification()` delegate to the configured
verification provider.

## Provider contracts

| Interface | Method |
|---|---|
| `MailProvider` | `sendMail(message)` |
| `SmsProvider` | `sendSms(message)` |
| `PushProvider` | `sendPush(message)` — one `SendResult` per token |
| `VerificationProvider` | `startVerification(options)`, `checkVerification(options)` |

Concrete SendGrid, Twilio, and Expo providers are separate adapter packages/subpath exports. Core
`@terreno/comms` has no concrete provider SDK dependencies.

## Configuration

```typescript
interface CommsAppOptions {
  basePath?: string; // default: "/comms"
  defaultFrom?: string;
  logMessages?: boolean; // default: true
  mail?: MailProvider;
  onDeliveryEvent?: (event: DeliveryEvent) => Promise<void>;
  push?: PushProvider;
  redactRecipients?: boolean; // default: true
  sms?: SmsProvider;
  verification?: VerificationProvider;
}
```

When a channel is unconfigured:

- non-production environments use the matching console provider and emit a warning;
- production throws a `501` `APIError` titled `Comms channel not configured`.

Delivery attempts are stored in `CommsMessage`. Recipient values are stored as `[redacted]` unless
`redactRecipients` is explicitly `false`.

## Routes

The default `basePath` is `/comms`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/comms/pushTokens` | Authenticated | Register or refresh a device token |
| `GET` | `/comms/pushTokens` | Authenticated owner | List the current user's tokens |
| `GET` | `/comms/pushTokens/:id` | Owner | Read one token |
| `DELETE` | `/comms/pushTokens/:id` | Owner | Deactivate a token |
| `GET` | `/comms/messages` | Admin | Filtered, paginated delivery log |

An active token cannot be claimed by another user. After its owner deactivates it, another
authenticated user on the same device may register it.

## Templates

`renderTemplate()` replaces top-level `{{variable}}` placeholders in `subject`, `text`, and `html`.
Missing or inherited properties render as empty strings.

```typescript
const message = renderTemplate({
  data: {name: "Ada"},
  template: {
    subject: "Welcome, {{name}}",
    text: "Hello {{name}}",
  },
});
```
