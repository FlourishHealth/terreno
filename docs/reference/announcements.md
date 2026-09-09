# Announcements reference

`@terreno/announcements` provides admin-managed in-app product update announcements.

## Plugin

```typescript
import {AnnouncementsApp} from "@terreno/announcements";

new TerrenoApp({ userModel: User })
  .register(new AnnouncementsApp({
    acknowledgementMode: "admin",
    help: {enabled: true},
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

## Help API (optional)

When `help.enabled` is true, authenticated users can search product update notes for MCP and in-app help. Draft announcements are never exposed.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/announcements/help/search` | Search published notes (`q`, `limit`, `includeArchived`) |
| GET | `/announcements/help/:id` | Full update note by Mongo id (`includeArchived`) |

`includeArchived=true` includes `archived` announcements alongside `published`. Omit it (default) to search only published notes.

## MCP integration

`@terreno/mcp` exposes three optional tools that search bundled `@terreno/*` upgrade markdown and, when configured, announcement help routes on your backend:

- `terreno_search_update_notes` — keyword search; returns summaries with ids
- `terreno_get_update_note` — full note by id (`upgrade:<semver>` or `announcement:<mongoId>`)
- `terreno_ask_update_help` — natural-language question with ranked matches and full bodies

Set these environment variables on the MCP server to include live announcements:

| Variable | Description |
|----------|-------------|
| `TERRENO_HELP_API_URL` | Backend base URL (e.g. `http://localhost:4000`) |
| `TERRENO_HELP_API_TOKEN` | Optional Bearer token for authenticated help routes |

## Consumer UI

`@terreno/ui` exports `AnnouncementNavigator`, `AnnouncementScreen`, `useAnnouncements`, and `useAcknowledgeAnnouncement`.

Markdown bodies support YouTube and Loom embeds via `MarkdownView`.
