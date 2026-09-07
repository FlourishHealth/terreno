---
category: Changed
---

The `terreno-planning` plugin now includes reusable Terreno backend/API, UI, data,
schema, SDK, admin, prompt-governance, documentation, upgrade, deployment, and UI
verification skills alongside the lifecycle. It also ships `pre-commit` and
`ui-verifier` agents. The redundant `commit` and `create-pr` skills are removed in
favor of Brew. Conflicting or unused Expo skills (`native-data-fetching`,
`building-native-ui`, `expo-ui`, App Clip, brownfield, Observe, Tailwind setup,
EAS update insights, and Expo module authoring) are no longer distributed. Taste's
pre-push gate runs lint, typecheck, and affected tests for every supported host.
Rulesync now also generates native stop hooks for Cursor, Claude Code, GitHub Copilot,
and Devin that run repository lint and typecheck. Plugin `terreno-planning` is `2.8.0`.
