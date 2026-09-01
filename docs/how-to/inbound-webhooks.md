# Receive inbound webhooks

Register provider callbacks on `WebhooksApp`. Signatures use `req.rawBody` — never
`JSON.stringify(req.body)`.

```typescript
import {hmacSignature, TerrenoApp, WebhooksApp} from "@terreno/api";

const webhooks = new WebhooksApp({idempotency: {store: "memory"}});
webhooks.route({
  path: "/webhooks/example",
  source: "example",
  verify: hmacSignature({secret: process.env.WEBHOOK_SECRET!, header: "X-Webhook-Signature"}),
  eventId: (req) => String((req.body as {id?: string})?.id ?? ""),
  handler: async () => undefined,
});

new TerrenoApp({userModel: User}).register(webhooks).start();
```

## Verifiers

| Helper | Header | Algorithm |
|--------|--------|-----------|
| `hmacSignature({secret, header})` | caller-chosen | HMAC of `rawBody` (default SHA-256 hex). Optional timestamp header + skew. |
| `stripeSignature({secret, toleranceSec?})` | `Stripe-Signature` | HMAC-SHA256 of `${t}.${rawBody}`. Default 300s timestamp window. |
| `twilioSignature({authToken, url})` | `X-Twilio-Signature` | HMAC-SHA1 base64 of callback URL + sorted POST fields. Form-urlencoded only. |
| `sendgridEventSignature({publicKey})` | `X-Twilio-Email-Event-Webhook-Signature` + timestamp | ECDSA P-256 over `${timestamp}${rawBody}`. |

Invalid or missing signatures return `401` with `code: "webhook-signature-invalid"`. Duplicate
`(source, eventId)` returns `200 {received: true, duplicate: true}` without running the handler.

Pass `idempotency: {store: "mongo"}` to persist claims in the `webhookReceipts` collection
(unique `(source, eventId)`, TTL 7 days on `created`). This is not a public `modelRouter` model.
Use `store: "memory"` in tests and single-process apps.
