---
category: Changed
---

Brew and Taste now discover and observe product CI on every configured host, including
CircleCI and Buildkite, not only GitHub check runs. Waits use provider-native hooks such
as `gh pr checks --watch`, `circleci run watch`, and `bk build watch` where available,
with bounded polling only as fallback. Plugin `terreno-planning` is `2.4.0`.
