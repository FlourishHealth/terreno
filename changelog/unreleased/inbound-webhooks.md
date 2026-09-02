---
category: Added
---

Inbound webhooks on `WebhooksApp`: raw-body capture, HMAC/Stripe/Twilio/SendGrid
verifiers (SendGrid ECDSA uses the same 300s timestamp window as Stripe), memory or
Mongo `webhookReceipts` idempotency. `CommsApp` mounts Twilio status/inbound and
SendGrid Event Webhook routes when passed the same plugin. `recordDeliveryEvent`
rethrows a failed `CommsMessage` save so webhook claims release. See
`docs/how-to/inbound-webhooks.md`.
