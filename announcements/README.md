# @terreno/announcements

In-app product update announcements for Terreno backends.

## Install

```bash
bun add @terreno/announcements
```

Peer dependency: `mongoose ^8.0.0 || ^9.0.0`. `@terreno/api` is required at runtime.

## Quick start

```typescript
import {AnnouncementsApp} from "@terreno/announcements";
import {TerrenoApp} from "@terreno/api";

new TerrenoApp({userModel: User})
  .register(
    new AnnouncementsApp({
      acknowledgementMode: "admin",
      help: {enabled: true},
      matchAudience: (user, announcement) => true,
    })
  )
  .start();
```

Wrap authenticated app content with `AnnouncementNavigator` from `@terreno/ui` on the frontend.

## What's included

- `AnnouncementsApp` — user routes (`/pending`, `/feed`, acknowledge, impression) plus admin CRUD
- Optional help API for MCP and agent search (`/announcements/help/*`)
- Audience targeting via `matchAudience` and `audience` JSON on each announcement
- Platform targeting (`ios`, `android`, `web`) with user-agent fallback when `platform` is omitted

## Documentation

- Reference: [docs/reference/announcements.md](https://github.com/FlourishHealth/terreno/blob/master/docs/reference/announcements.md)
- How-to: [docs/how-to/product-announcements.md](https://github.com/FlourishHealth/terreno/blob/master/docs/how-to/product-announcements.md)
- Implementation plan: [docs/implementationPlans/announcements.md](https://github.com/FlourishHealth/terreno/blob/master/docs/implementationPlans/announcements.md)

## License and Contributing

Licensed under the [MIT License](https://github.com/FlourishHealth/terreno/blob/master/LICENSE). See [CONTRIBUTING.md](https://github.com/FlourishHealth/terreno/blob/master/CONTRIBUTING.md) for contribution guidelines.
