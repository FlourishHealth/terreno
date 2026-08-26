---
category: Changed
---

`@terreno/api` `asyncHandler` now types the request as Express `Request` instead
of `any`. `@terreno/ui` Hyperlink props (`linkify`, styles, `injectViewProps`)
and the Google Maps `window.google` global use concrete types instead of `any`.
