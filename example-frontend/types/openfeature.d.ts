/**
 * Augment OpenFeature core with the example app's known flag keys for stricter
 * typing when using `useBooleanFlagValue` / `useStringFlagValue`.
 *
 * @see https://openfeature.dev/docs/reference/sdks/client/web#typing
 */
declare module "@openfeature/core" {
  export type BooleanFlagKey =
    | "ai-features"
    | "dark-mode-toggle"
    | "todo-priority"
    | "todo-summary-card"
    | "use-syncdb";

  export type StringFlagKey = "profile-layout";
}
