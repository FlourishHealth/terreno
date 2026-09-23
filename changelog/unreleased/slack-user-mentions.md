---
category: Added
---

`sendToSlack` accepts `mentionUserIds` (Slack member IDs) so incoming webhooks can @-mention people. Names and emails in the message text do not notify anyone. New helpers: `formatSlackUserMention`, `normalizeSlackUserId`, and `lookupSlackUserIdByEmail` (optional `SLACK_BOT_TOKEN` with `users:read.email` to resolve an id from email and store it on the staff/user record).
