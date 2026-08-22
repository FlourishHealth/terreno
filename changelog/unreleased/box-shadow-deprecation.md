---
category: Fixed
---

- `@terreno/ui` no longer triggers the react-native-web warning `"shadow*" style props are
  deprecated. Use "boxShadow".` — `Filter`, `WebDropdownMenu` (select fields, timezone picker,
  address field), and `DraggableList` now use `boxShadow`, and the new `createBoxShadow` /
  `applyColorOpacity` helpers build the shadow value from a color plus opacity.
- Patched `react-native-modalize` and `react-native-actions-sheet` to use `boxShadow` on
  iOS/web and `elevation` only on Android, so the two APIs do not stack. The modalize
  stylesheet ran at import time, so the deprecation warning appeared on every web page that
  imported `@terreno/ui`.
- Android centered dropdowns (`WebDropdownMenu` `presentation="centered"`) keep `elevation` and
  omit `boxShadow`, so the two APIs do not stack.
