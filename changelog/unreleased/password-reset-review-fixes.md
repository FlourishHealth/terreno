---
category: Fixed
---

JWT password reset now updates Better Auth credentials and sessions when both stacks are mounted, mailbox changes invalidate unused reset tokens, authenticated verification resend returns 501 without a `publicAppUrl`, and Better Auth recovery hooks refuse to send relative links.
