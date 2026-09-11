---
category: Added
---

`@terreno/syncdb` exports `bridgeBetterAuthReactClient`, which adapts a Better Auth
**react** client to the session-subscription surface `betterAuthAdapter` watches. Without
it the adapter cannot see the client's nanostore session atom and falls back to polling
`getSession()`. The example app and the admin SPA both use it.
