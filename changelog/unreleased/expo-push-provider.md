---
category: Added
---

`ExpoPushProvider` at `@terreno/comms/adapters/expoPush` (optional peer
`expo-server-sdk`). `sendPush` returns one `SendResult` per token, chunks Expo
payloads, classifies ticket/receipt errors, and polls receipts. `DeviceNotRegistered`
deactivates `PushToken` rows via `CommsService.deactivatePushToken`. `MessageTooBig` is
`errorClass: config` and does not deactivate the token. `expo-server-sdk`
moved off `@terreno/api`. The example app requests notification permission, registers the device token after
login, and exposes a profile-screen test send (`POST /comms/dev/testPush`) in
non-production.
