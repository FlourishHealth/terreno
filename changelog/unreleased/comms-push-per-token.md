---
category: Fixed
---

Push hooks and retries are per-token; provider results are zipped to token strings
after `beforeSend`. Mail payloads retain `replyTo` and `dynamicTemplateData`.
`DeliveryEvent.errorClass` is persisted on the log row. `defaultFrom` is reapplied
after `beforeSend`. Payload cleanup is best-effort and cannot fail `logSend` /
`appendAttempt`.
