# Admin plugin frontend widgets

Backend plugins contribute stable widget IDs through `adminContribution()`. Their React
implementations ship from `@terreno/admin-frontend`, under `src/widgets/`.

This keeps the first-party integration in one frontend package and avoids making backend-only
packages depend on React Native. The built-in registry includes consent field widgets, feature
flag home widgets, and Documents/AI custom screens. Hosts can override any ID through
`AdminProvider.widgets`.

Third-party plugins should publish their own frontend package and ask the host to spread its
registry into `AdminProvider`; `@terreno/admin-frontend` only owns first-party Terreno widgets.
