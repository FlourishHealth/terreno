---
category: Added
---

`@terreno/comms` Phase 1 gap-fill: `beforeSend` mutate/cancel, `recordDeliveryEvent` /
`recordOptOut`, attempt history on `CommsMessage`, payload retention
(`retainPayloadDays`, `redactPayload`), and channel-wide transient retry (SMS,
verification start, per-token push). `onRetry` stays `(context, result)` with
`context.attempt`. Push prune honors `errorClass: "permanent"` as well as
`isPermanentFailure`.
