---
category: Fixed
---

Example backend Cloud Run images include `twilio` in the compiled binary by injecting
a Twilio client into the SMS and Verify adapters. Invalid SMS destinations return a
permanent `SendResult` instead of throwing, so the facade does not retry them. Partial
Twilio env in the example backend throws `APIError` at boot.
