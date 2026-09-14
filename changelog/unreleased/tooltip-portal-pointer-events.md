---
category: Fixed
---

`Tooltip` no longer disappears the instant it opens on web. The portal layer that
renders overlays (tooltips, modals, toasts) declared `pointerEvents: "box-none"` in an
inline style, which react-native-web drops, so every mounted portal covered the app with
a full-screen overlay that swallowed hover and press events. The portal layer now uses a
registered `StyleSheet` style, and `Tooltip` stays off screen until its trigger has been
measured instead of flashing in the top-left corner.
