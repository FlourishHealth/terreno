# Product announcements

Use `@terreno/announcements` on the backend and `AnnouncementNavigator` on the frontend to show admin-managed update surfaces.

## Backend

1. Register the plugin on your `TerrenoApp`:

```typescript
import {AnnouncementsApp} from "@terreno/announcements";

new AnnouncementsApp({
  defaultAcknowledgementPolicy: "dismiss-only",
  matchAudience: (user, announcement) => {
    const audience = announcement.audience as {roles?: string[]};
    if (!audience.roles?.length) {
      return true;
    }
    return audience.roles.includes((user as {role?: string}).role ?? "");
  },
});
```

2. Create announcements in admin (draft → publish). Use `AnnouncementList` and `AnnouncementEditor` from `@terreno/admin-frontend` with dedicated Expo routes (see `example-frontend/app/admin/announcements/`). Published `title`/`body` edits auto-increment `version`, which re-shows the surface to users who only acknowledged the previous version.

## Frontend

Wrap authenticated app content:

```tsx
import {AnnouncementNavigator} from "@terreno/ui";

<AnnouncementNavigator api={terrenoApi}>
  <AppTabs />
</AnnouncementNavigator>
```

Place it after consent/onboarding wrappers if you use `ConsentNavigator`. The navigator sends the native platform (`ios` / `android` / `web`) and, when available, the app build number from `Constants.expoConfig.extra.buildNumber` (same source as `useUpgradeCheck`) on pending and feed requests. Only pending failures block the app — changelog feed errors are non-fatal.

## Modal vs banner

| `displayMode` | Navigator behavior |
|---------------|-------------------|
| `modal` | Renders `AnnouncementScreen` and hides children until the announcement is cleared. |
| `banner` | Keeps children mounted and renders `AnnouncementBanner` above them (one interrupt at a time). |
| `feed` | Changelog-only; never shown by `AnnouncementNavigator` even if it appears unexpectedly in `pending.current`. |

`AnnouncementBanner` composes the existing `Banner` component: title text, a dismiss or acknowledgement action, and an optional primary-action button (URL opens on press; click analytics land in a later slice).

Acknowledgement policy still resolves to `requiresAcknowledgement` on the public DTO:

| Policy | Banner / modal behavior |
|--------|-------------------------|
| `required` | Primary action is **Got it**, which acknowledges through the existing handler. |
| `dismiss-only` | Dismiss records an impression only. |

Impressions are recorded once per announcement version while the modal or banner is visible.

## Client frequency caps

Interrupt frequency is enforced **client-side** in `AnnouncementNavigator` before a modal or banner is shown. The server still returns the full pending queue; caps never filter `useAnnouncements` feed data.

```tsx
<AnnouncementNavigator
  api={terrenoApi}
  frequency={{
    maxInterruptionsPerSession: 1,
    cooldownHours: 24,
    skipFirstLaunch: true,
    userId: currentUser?.id,
  }}
>
  <AppTabs />
</AnnouncementNavigator>
```

| Prop | Default | Behavior |
|------|---------|----------|
| `maxInterruptionsPerSession` | `1` | In-memory session counter. After the cap is reached, pending interrupts are skipped until the app remounts (new session). |
| `cooldownHours` | off | When set, skips interrupts if the last shown interrupt was within this many hours. Timestamp is persisted in AsyncStorage when an interrupt becomes visible. |
| `skipFirstLaunch` | `false` | When `true`, the first app launch ever (no `hasLaunched` key) records the flag and skips interrupts for that launch only. |
| `userId` | `"anon"` | AsyncStorage namespace for frequency keys when a signed-in user id is available. |

When a cap applies, the navigator renders children (does not block the app) and does **not** record an impression. AsyncStorage read/write failures fail open with a `console.warn` and allow the interrupt to show.

## Media in markdown

Paste YouTube or Loom URLs in the announcement `body` using markdown links or images, for example `[Watch the demo](https://www.youtube.com/watch?v=...)`. `MarkdownView` renders them as embeds (iframe on web, WebView on native). Banner surfaces show the title only; use modal mode or the feed when the full body should be visible.

## Example app

`example-backend` registers `AnnouncementsApp` and seeds a welcome announcement via `bun run backend:seed`.
