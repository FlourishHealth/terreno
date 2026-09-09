---
category: Fixed
---

Admin custom screens now show a clickable back arrow by default. The shared
`AdminScreenPage` routes back to admin home reliably on web instead of depending on
browser history, and `Page` supports an explicit `onBack` handler.
