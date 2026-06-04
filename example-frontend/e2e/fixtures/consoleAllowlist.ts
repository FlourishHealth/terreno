// Patterns that should NOT fail e2e tests when emitted as console.warn,
// console.error, or page errors. Use sparingly — prefer fixing the underlying
// issue. Entries are matched as substrings against the message text. Regex
// entries are matched with .test().

export const GLOBAL_CONSOLE_ALLOWLIST: ReadonlyArray<string | RegExp> = [
  // React Native Web deprecation: shadow* style props.
  // Source: @terreno/ui (WebDropdownMenu, DraggableList) and Box's shadow prop.
  // TODO(ui): migrate shadow* styles to boxShadow.
  '"shadow*" style props are deprecated. Use "boxShadow".',

  // React Native Web deprecation: pointerEvents prop.
  // Source: @terreno/ui (ToastNotifications, DateTimeField, SidebarNavigation).
  // TODO(ui): migrate pointerEvents prop to style.pointerEvents.
  "props.pointerEvents is deprecated. Use style.pointerEvents",

  // react-redux memoization warning. Some selectors in the dependency tree
  // return new array/object references each call. TODO(rtk/example-frontend):
  // audit selectors and wrap with createSelector where appropriate.
  "Selector unknown returned a different result when called with the same parameters",
];
