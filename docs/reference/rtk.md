# @terreno/rtk

Redux Toolkit Query utilities for frontends using @terreno/api backends. JWT auth, token storage, and SDK code generation from OpenAPI.

## Key exports

- `generateAuthSlice` — Auth reducer and middleware
- `emptyApi` — Base RTK Query API for codegen
- Platform utilities for secure token storage (expo-secure-store / AsyncStorage)

See the [rtk package source](../../rtk/src/) and [.cursor/rules/rtk/](../../.cursor/rules/rtk/) for setup and usage.
