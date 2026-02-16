---
targets: ["cursor", "windsurf", "copilot", "claudecode"]
description: "terreno-demo - Interactive showcase for @terreno/ui components"
globs: ["**/*"]
---

# terreno-demo

Interactive demo app for developing, testing, and showcasing @terreno/ui components. Built with Expo Router. This is a **frontend-only** app — no backend, no API integration.

## Commands

```bash
bun run start            # Start Expo dev server (port 8085)
bun run web              # Start web version
bun run ios              # Start iOS simulator
bun run android          # Start Android emulator
bun run export           # Export static web build to dist/
bun run compile          # Type check
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
```

## Deployment

Deployed to Google Cloud Storage with Cloud CDN via `demo-deploy.yml` workflow.

- **Production**: Deploys to `flourish-terreno-terreno-demo` bucket on master push (when demo/ or ui/ changes)
- **Preview**: Deploys to `_previews/pr-{number}/` on pull requests, cleanup on PR close via `preview-cleanup.yml`
- **CDN**: Backend bucket `terreno-demo-backend` with URL map, HTTP proxy, and global static IP

Production uses long-cache headers for assets (1 year immutable) and no-cache for index.html. Preview deploys use no-cache for all files and upload bare route objects for SPA routing support.

## Architecture

### File Structure

```
app/
  _layout.tsx            # Root layout with dev mode toggle
  demo/
    _layout.tsx          # Demo section layout
    index.tsx            # Demo home - component list
    [component].tsx      # Dynamic route for each component demo
  dev/
    _layout.tsx          # Dev section layout
    index.tsx            # Dev home page
    [component].tsx      # Dynamic route for dev components
components/
  DemoHomePage.tsx       # Home page with component grid
  DevHomePage.tsx        # Developer mode home
  ErrorBoundary.tsx      # Error boundary wrapper
stories/
  *.stories.tsx          # Component story files
demoConfig.tsx           # Configuration mapping component names to demos
```

### Two Modes

- **Demo mode**: User-facing component showcase with polished examples
- **Dev mode**: Developer-focused testing with raw component manipulation. Accessible via header button.

### Dynamic Routing

Components are rendered via `[component].tsx` catch-all routes. The component name comes from the URL and maps through `demoConfig.tsx` to the actual demo component.

## Adding a Component Demo

1. Create a story file in `stories/`:
```typescript
// stories/MyComponent.stories.tsx
import {Box, Text, MyComponent} from "@terreno/ui";

export const MyComponentDemo: React.FC = () => (
  <Box padding={4} gap={4}>
    <Text size="lg">MyComponent Demo</Text>
    <MyComponent prop="value" />
    <MyComponent prop="other" disabled />
  </Box>
);
```

2. Register in `demoConfig.tsx` to make it navigable.

## Conventions

- Import all components from `@terreno/ui` — this app exists to exercise them
- Show multiple variants/states of each component (default, disabled, error, loading)
- Use `Box` for layout, `Text`/`Heading` for content
- Use `TerrenoProvider` (already set up in root layout)
- Wrap demos in `ErrorBoundary` for stability
- Use functional components with `React.FC` type
- Use inline styles over `StyleSheet.create`
- Use Luxon for date operations
- Always support React Native Web
