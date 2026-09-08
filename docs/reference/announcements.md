# Announcements reference

`@terreno/announcements` provides admin-managed in-app product update announcements.

## Plugin

```typescript
import {AnnouncementsApp} from "@terreno/announcements";

new TerrenoApp({ userModel: User })
  .register(new AnnouncementsApp({
    acknowledgementMode: "admin",
    matchAudience: (user, announcement) => true,
  }))
  .start();
```

## Models

- **Announcement** — `title`, `body` (markdown), `status` (`draft` | `published` | `archived`), `version`, `priority`, `requiresAcknowledgement`, `audience` (Mixed), `publishAt`, `expiresAt`, `platforms`, `primaryAction`
- **AnnouncementAcknowledgement** — per-user acknowledgement at a specific `version`
- **AnnouncementImpression** — per-view analytics row

## User routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/announcements/pending` | Current modal item + `remainingCount` |
| GET | `/announcements/feed` | Paginated published changelog |
| POST | `/announcements/:id/acknowledge` | Record acknowledgement (idempotent per version) |
| POST | `/announcements/:id/impression` | Record a view |

## Admin routes

Admin CRUD is on `/announcements` via `modelRouter`. Custom actions:

- `POST /announcements/:id/publish` — draft → published
- `POST /announcements/:id/archive` — published → archived

Read-only admin lists: `/announcement-acknowledgements`, `/announcement-impressions`.

## Consumer UI

`@terreno/ui` exports `AnnouncementNavigator`, `AnnouncementScreen`, `useAnnouncements`, and `useAcknowledgeAnnouncement`.

Markdown bodies support YouTube and Loom embeds via `MarkdownView`.
