# Product announcements

Use `@terreno/announcements` on the backend and `AnnouncementNavigator` on the frontend to show admin-managed update modals.

## Backend

1. Register the plugin on your `TerrenoApp`:

```typescript
import {AnnouncementsApp} from "@terreno/announcements";

new AnnouncementsApp({
  acknowledgementMode: "admin",
  matchAudience: (user, announcement) => {
    const audience = announcement.audience as {roles?: string[]};
    if (!audience.roles?.length) {
      return true;
    }
    return audience.roles.includes((user as {role?: string}).role ?? "");
  },
});
```

2. Create announcements in admin (draft → publish). Published `title`/`body` edits auto-increment `version`, which re-shows the modal to users who only acknowledged the previous version.

## Frontend

Wrap authenticated app content:

```tsx
import {AnnouncementNavigator} from "@terreno/ui";

<AnnouncementNavigator api={terrenoApi}>
  <AppTabs />
</AnnouncementNavigator>
```

Place it after consent/onboarding wrappers if you use `ConsentNavigator`.

## Acknowledgement modes

| Mode | Behavior |
|------|----------|
| `admin` (default) | Honour per-announcement `requiresAcknowledgement` |
| `always` | Every pending announcement requires acknowledgement |
| `never` | Dismiss records an impression only |

## Media in markdown

Paste YouTube or Loom URLs in the announcement `body`. `MarkdownView` renders them as embeds (iframe on web, WebView on native).

## Example app

`example-backend` registers `AnnouncementsApp` and seeds a welcome announcement via `bun run backend:seed`.
