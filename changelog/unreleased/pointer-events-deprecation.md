---
category: Fixed
---

- `@terreno/ui` no longer triggers the React Native Web warning
  `props.pointerEvents is deprecated. Use style.pointerEvents`. Every component that set
  `pointerEvents` as a prop (`DateTimeField`, `Filter`, `SidebarNavigation`, `ToastNotifications`,
  `WebDropdownMenu`) now sets it in `style`.
- The `react-native-portalize` dependency, which set the deprecated prop on every screen through
  `TerrenoProvider`, is replaced by an internal portal host. `Host` and `Portal` are now exported
  from `@terreno/ui` with the same API.
