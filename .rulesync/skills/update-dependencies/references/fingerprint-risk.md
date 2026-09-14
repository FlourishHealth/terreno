# Fingerprint risk

Native Expo fingerprints for `example-frontend` and `demo` must stay stable
outside a release. A changed hash means every developer needs a new EAS dev
build.

The executable skip list is `scripts/planning/fingerprintRisk.ts`
(`isFingerprintSkip`). This page explains the categories; do not maintain a
second name list here.

## Skip without attempting

`isFingerprintSkip` is true:

- `expo` and `expo-*`
- `react-native` and `react-native-*` except `react-native-web`
- `@react-native/*`, `@react-native-community/*`, `@react-native-async-storage/*`, `@react-native-picker/*`
- `@expo/config-plugins`
- `@sentry/react-native`
- `@shopify/flash-list`, `@shopify/react-native-skia`

Also skip (not package names): `eas.json` Bun pins, `app.json` native keys,
config plugins, `ios/`, `android/`.

Those land only in a release via `upgrading-expo`.

## Attempt, then measure

JavaScript packages, `react-native-web`, `@expo/metro-runtime`,
`@expo/vector-icons`, `@expo-google-fonts/*`, `babel-preset-expo`, and GitHub
Actions pins may be bumped. After install, still recompute fingerprints for
both apps. If a hash moves, revert. The matcher can be wrong; the hash is the
gate.

## How to hash

From each of `example-frontend/` and `demo/`:

```bash
eas fingerprint:generate --platform ios --non-interactive --json
eas fingerprint:generate --platform android --non-interactive --json
```

Without `EXPO_TOKEN`: `bunx @expo/fingerprint <app-dir>`. Use the same tool for
baseline and post-bump. Apps use `fingerprint.config.js` (`ExpoConfigExtraSection`,
`PackageJsonScriptsAll` skipped).
