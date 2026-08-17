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
verification provider. `startVerification()` accepts `channel: "sms"` or `channel: "email"`;
`checkVerification()` verifies the code against the same phone number or email destination and may
return an `error` reason when `valid` is false. Start attempts store the verification channel in
delivery-log metadata while recipient values remain redacted.

## Provider contracts

| Interface | Method |
|---|---|
| `MailProvider` | `sendMail(message)` |
| `SmsProvider` | `sendSms(message)` |
| `PushProvider` | `sendPush(message)` — one `SendResult` per token |
| `VerificationProvider` | `startVerification(options)`, `checkVerification(options)` |

Concrete SendGrid, Twilio, and Expo providers are separate adapter packages/subpath exports. Core
`@terreno/comms` has no concrete provider SDK dependencies.

### SendGrid mail adapter

```bash
bun add @sendgrid/mail
```

```typescript
import {CommsApp} from "@terreno/comms";
import {SendGridMailProvider} from "@terreno/comms/adapters/sendgrid";

new TerrenoApp({userModel: User})
  .register(
    new CommsApp({
      defaultFrom: "notifications@example.com",
      mail: new SendGridMailProvider({
        // apiKey defaults to process.env.SENDGRID_API_KEY (required)
        fromEmail: "notifications@example.com",
        fromName: "Terreno",
        // sandboxMode defaults to true when NODE_ENV === "test"
      }),
      onError: async (_context, result) => {
        console.error("mail failed", result.errorCode, result.errorClass);
      },
    })
  )
  .start();
```

`SendGridMailProvider` fails fast at construction when `SENDGRID_API_KEY` (or `apiKey`) is
missing. Send-time failures never throw through `sendMail`; they return
`accepted: false` with `errorCode` / `errorClass` (`permanent` | `transient` | `config`).
Transient failures are retried once by `CommsService`. Accepted sends store the SendGrid
`x-message-id` and a `metadata.consoleUrl` Email Activity deep link on the `CommsMessage`
row.

**Sender verification checklist (SendGrid):**

1. Create an API key with Mail Send permission.
2. Verify the from domain (or single sender) in SendGrid.
3. Confirm the from address matches a verified identity.
4. Use sandbox mode in CI/tests so no real mail is delivered.

## Configuration

```typescript
interface CommsAppOptions {
  basePath?: string; // default: "/comms"
  defaultFrom?: string;
  logMessages?: boolean; // default: true
  mail?: MailProvider;
  onDeliveryEvent?: (event: DeliveryEvent) => Promise<void>;
  onError?: (context: CommsHookContext, result: SendResult) => Promise<void>;
  onRetry?: (context: CommsHookContext, result: SendResult) => Promise<void>;
  onSend?: (context: CommsHookContext, result: SendResult) => Promise<void>;
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
