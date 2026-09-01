---
category: Added
---

Inbound webhooks on `WebhooksApp`: raw-body capture, HMAC/Stripe/Twilio/SendGrid
verifiers, memory or Mongo `webhookReceipts` idempotency. `CommsApp` mounts Twilio
status/inbound and SendGrid Event Webhook routes when passed the same plugin. See
`docs/how-to/inbound-webhooks.md`.
