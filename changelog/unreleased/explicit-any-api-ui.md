---
category: Changed
---

`@terreno/api` RBAC routes now narrow path parameters at runtime instead of
relying on implicit `any`. `@terreno/ui` Hyperlink props (`linkify`, styles,
`injectViewProps`) and the Google Maps `window.google` global use concrete
types instead of `any`.
