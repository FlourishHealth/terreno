---
category: Added
---

`SendGridMailProvider` at `@terreno/comms/adapters/sendgrid` (optional peer
`@sendgrid/mail`) with sandbox mode, `errorCode`/`errorClass` taxonomy, Email Activity
deep links, and one transient retry via `CommsService` hooks (`onError` / `onRetry` /
`onSend`).
