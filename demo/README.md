# terreno-demo

Interactive Expo app for developing, testing, and showcasing `@terreno/ui` components. Private workspace package — not published to npm.

## Install

From the monorepo root:

```bash
bun bootstrap
```

## Quick start

From the repo root:

```bash
bun run demo:start
```

Or from this directory:

```bash
bun run web
```

The demo serves on **port 8085**. Open the Expo web URL that the CLI prints (typically `http://localhost:8085`).

- **Demo mode** — polished component showcase
- **Dev mode** — raw prop playground (toggle from the header)

## What's included

- `stories/` — one `*.stories.tsx` file per component demo
- `story-config/` — `DemoConfiguration` objects consumed by `demoConfig.tsx`
- `demoConfig.tsx` — registers stories so they appear in the home grid and `[component]` routes
- `app/demo/` — user-facing showcase routes
- `app/dev/` — developer playground routes

## Add a story

1. Create `stories/MyComponent.stories.tsx` with a `React.FC` demo using `@terreno/ui`.
2. Add a `story-config/MyComponent.config.tsx` export (`name`, `interfaceName`, category).
3. Import that config in `demoConfig.tsx` and add it to the exported list.

## Documentation

UI reference: [docs/reference/ui.md](https://github.com/flourishhealth/terreno/blob/master/docs/reference/ui.md)

## License and Contributing

Licensed under the [MIT License](https://github.com/flourishhealth/terreno/blob/master/LICENSE). See [CONTRIBUTING.md](https://github.com/flourishhealth/terreno/blob/master/CONTRIBUTING.md) for contribution guidelines.
