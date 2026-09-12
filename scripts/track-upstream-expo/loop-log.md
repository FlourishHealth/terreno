# Expo SDK loop log

Handoff file for `/track-upstream-expo`. The next morning reads this before
changing code. Keep it on the `release-*` branch once a loop starts.

Template: `.rulesync/skills/track-upstream-expo/references/loop-log.md`.

## Status

- sdkLine: 58.0.0
- expoVersion: 58.0.0-preview.0
- releaseBranch: release-58.0.0
- loopStatus: open
- updatedAt: 2026-09-12T12:27:18.000Z

## Next

Drop `compilerOptions.customConditions: ["react-native-legacy-deep-imports"]` from `ui/tsconfig.json` and `admin-frontend/tsconfig.json` and adopt RN 0.87 generated types.

## Open

- [ ] Drop `compilerOptions.customConditions: ["react-native-legacy-deep-imports"]` from `ui/tsconfig.json` and `admin-frontend/tsconfig.json` and adopt RN 0.87 generated types
- [ ] `SidebarNavigation` `initialRouteName` is a no-op; callers must set expo-router `unstable_settings.initialRouteName` on the layout (see `demo/app/_layout.tsx`)
- [ ] TinyBase 9.5 still peers `expo-sqlite ^57`; `defaultPersisterFactory.native.ts` casts through `unknown`
- [ ] `mcp-server/src/bootstrap.ts` still scaffolds Expo `~57.0.14` (published `@terreno/*` is still 57.x)

## Tried (newest first)

### 2026-09-12T12:27:18.000Z — 58.0.0-preview.0
- Action: Override `expo-image-loader` to `58.0.1`, bump catalog `expo-image-manipulator` to `~58.0.1`, delete stale `node_modules/expo-image-picker/node_modules/expo-image-loader@58.0.0`. Exclude `@react-native-community/blur` from `expo.doctor.reactNativeDirectoryCheck` in example-frontend + demo.
- Result: worked
- Evidence: `cd example-frontend && bunx expo-doctor` 20/20; `cd demo && bunx expo-doctor` 20/20. `bun run compile` exit 0; `bun run lint` exit 0; `bun run frontend:lint` exit 0; `bun run ui:test` 2245 pass / 0 fail.
- Follow-up: see Open

### 2026-09-12T12:22:00.000Z — 58.0.0-preview.0
- Action: Remove `tinybase>expo` / `tinybase>expo-sqlite` override keys. Keep global `expo` / `expo-sqlite` overrides. Nested object form `"tinybase": { "expo": "..." }` is ignored on Bun 1.3.11.
- Result: worked
- Evidence: `npm explain expo-cli --json` no longer `EINVALIDTAGNAME` (`Invalid tag name "tinybase>expo"`). expo-doctor npm-explain checks pass.
- Follow-up: none

### 2026-09-12T12:19:00.000Z — 58.0.0-preview.0
- Action: Merge `origin/master` into `release-58.0.0`, `bun install` with `linker = "hoisted"`.
- Result: worked
- Evidence: `example-frontend/node_modules/expo` gone; single `node_modules/expo@58.0.0-preview.0`. Duplicate `expo@58` copies that blocked 2026-09-11 doctor are gone.
- Follow-up: none

### 2026-09-12T12:14:25.000Z — probe
- Action: `bun run expo:track-probe` from `origin/master`
- Result: worked
- Evidence: exit 0, `action: resume-loop`, `expoVersion: 58.0.0-preview.0`, `releaseBranch: release-58.0.0`, `loopStatus: open`
- Follow-up: see Open

### 2026-09-11T12:42:45.000Z — 58.0.0-preview.0
- Action: Mock `expo-constants` / `expo-modules-core` / `expo-router/build/views/Screen` in `ui/src/bunSetup.ts` so bun never loads Expo 58's empty `expo-modules-core/build/ts-declarations/SharedRef.js` (`export {}`)
- Result: worked
- Evidence: `bun run ui:test` — 2243 pass, 0 fail (was 2 fail / 2 errors: `SyntaxError: Export named 'SharedRef' not found`)
- Follow-up: none

### 2026-09-11T12:35:00.000Z — 58.0.0-preview.0
- Action: Prune leftover nested `expo@57` / `expo-*@57` trees (not in `bun.lock`) then `bun install`; re-run expo-doctor
- Result: failed
- Evidence: `cd example-frontend && bunx expo-doctor` exit 1. Version mismatches (57 vs 58) gone. First remaining line: `✖ Check that no duplicate dependencies are installed` / `Found duplicates for expo:` `expo@58.0.0-preview.0` at `node_modules/expo` and `../node_modules/expo`. Also `npm explain` failures under bun.
- Follow-up: see Open

### 2026-09-11T12:30:00.000Z — 58.0.0-preview.0
- Action: `bun run compile`, `bun run lint`, `bun run frontend:lint` after RN 0.87 / Router 58 source fixes
- Result: worked
- Evidence: compile exit 0; lint exit 0 (warnings only, same as master); `bun run frontend:lint` exit 0
- Follow-up: none

### 2026-09-11T12:20:00.000Z — 58.0.0-preview.0
- Action: Pin root catalog + overrides to Expo `58.0.0-preview.0` and native fingerprint packages; `bun install`
- Result: worked
- Evidence: catalog `expo` is `58.0.0-preview.0`; `react-native` `0.87.1`; apps still use `"catalog:"`
- Follow-up: see Open

### 2026-09-11T12:15:08.999Z — probe
- Action: `bun run expo:track-probe` from `origin/master`
- Result: worked
- Evidence: exit 0, `action: create-branch`, `expoVersion: 58.0.0-preview.0`, `releaseBranch: release-58.0.0`
- Follow-up: see Open

## Do not retry

- Bun 1.3.11 nested override object (`"tinybase": { "expo": "58.0.0-preview.0" }`): `warn: Bun currently does not support nested "overrides"`. Wait for Bun 1.4 or a new Expo preview. Global `overrides.expo` / `overrides.expo-sqlite` already pin the tree.
- pnpm-style `"tinybase>expo"` override keys: `npm explain` fails with `EINVALIDTAGNAME: Invalid tag name "tinybase>expo"`, which made expo-doctor's npm-explain checks error. Removed 2026-09-12.

## Worked

- Catalog Expo `58.0.0-preview.0` (`npmTag: next`); RN `0.87.1`; RNGH `~3.2.1`; webview `14.0.1`; reanimated `4.6.0` + worklets `0.12.2`; screens `~4.27.0`; safe-area `~5.9.1`; svg `15.15.5`; drawer-layout `4.2.10`; skia `2.11.2`; sentry-native `~7.11.0` (Expo bundled, not 8.x); datetimepicker `9.2.1`; slider `5.2.1`; flash-list `2.0.2`; async-storage `2.2.0`. Overrides pin `expo`, `expo-sqlite`, and `expo-image-loader@58.0.1`. Catalog `expo-image-manipulator` `~58.0.1`.
- `@terreno/ui` peer `react-native` `~0.87.0`.
- Expo Router 58: `initialRouteName` moved off `<Navigator>` / `<Slot>` to layout `unstable_settings` (`demo/app/_layout.tsx`). `SidebarNavigation` stopped passing the prop.
- ActionSheet maps boolean `keyboardShouldPersistTaps` to `"always"` / `"never"` (RN 0.87 FlatList).
- `useUpgradeCheck` coalesces `AppState.current` with `?? ""`.
- TinyBase native persister: cast DB through `unknown` for expo-sqlite 58 vs TinyBase's `^57` peer types.
- Temporary `customConditions: ["react-native-legacy-deep-imports"]` in ui + admin-frontend tsconfigs so RN 0.87 `types_generated` does not break View/ScrollView/TextInput refs.
- bun tests: mock Expo 58 `SharedRef` hole (`export {}` in `build/ts-declarations/SharedRef.js`).
- 2026-09-12: `example-frontend` and `demo` `bunx expo-doctor` 20/20. Same-version bun `expo` duplicates gone after hoisted reinstall. `tinybase>expo` keys removed so `npm explain` works. Directory check excludes `@react-native-community/blur` (unmaintained, used by `@terreno/ui`).

## Release notes draft

### Breaking

- Expo SDK 58 / React Native 0.87. `@terreno/ui` peer is `react-native` `~0.87.0`.
- `react-native-gesture-handler` major 2 → 3 (`~3.2.1`).
- `react-native-webview` major 13 → 14 (`14.0.1`).
- Expo Router: `initialRouteName` is no longer a `<Navigator>` / `<Slot>` prop. Set `export const unstable_settings = { initialRouteName: "..." }` on the layout. `SidebarNavigation` `initialRouteName` is ignored.

### Native fingerprint

- `expo` `58.0.0-preview.0`
- `react-native` `0.87.1`
- `react-native-gesture-handler` `~3.2.1`
- `react-native-reanimated` `4.6.0` + `react-native-worklets` `0.12.2`
- `react-native-screens` `~4.27.0`
- `react-native-safe-area-context` `~5.9.1`
- `react-native-webview` `14.0.1`
- `react-native-svg` `15.15.5`
- `react-native-drawer-layout` `4.2.10`
- `@shopify/react-native-skia` `2.11.2`
- `@sentry/react-native` `~7.11.0`
- `@react-native-community/datetimepicker` `9.2.1`
- `@react-native-community/slider` `5.2.1`
- `@shopify/flash-list` `2.0.2`
- `@react-native-async-storage/async-storage` `2.2.0`
- `expo-image-manipulator` `~58.0.1`
- `expo-image-loader` `58.0.1` (override; picker still `@next` 58.0.0)
- All other catalog `expo-*` / `@expo/*` / `babel-preset-expo` on `~58.0.0`

### Expo API

- Router `unstable_settings.initialRouteName` replaces Navigator/Slot `initialRouteName`.
- RN 0.87 FlatList `keyboardShouldPersistTaps` is `"always" | "never" | "handled"`, not boolean.

### Other

- Created `release-58.0.0` from `origin/master` for Expo `58.0.0-preview.0` (`npmTag: next`). Do not merge to master until the loop is `ready`.
- `mcp-server` app bootstrap still emits Expo 57 until Terreno 58 is cut.
- TinyBase still declares `expo-sqlite ^57`.
- example-frontend / demo `expo.doctor.reactNativeDirectoryCheck.exclude`: `@react-native-community/blur`.
