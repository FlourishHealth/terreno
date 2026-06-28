// Fingerprint configuration for the Expo native runtime.
//
// `runtimeVersion.policy: "fingerprint"` (app.json) ties the OTA-update runtime
// version — and the CI "needs a new dev build?" check — to this fingerprint.
// By default `@expo/fingerprint` hashes the entire evaluated Expo config,
// including the `extra` section. Everything we put in `extra` (BASE_URL,
// debug flags, the EAS projectId, any build metadata) is consumed purely by JS
// at runtime and is shipped inside the JS bundle via EAS Update — none of it
// changes the compiled native binary. Letting those values feed the fingerprint
// forces an unnecessary full native rebuild whenever a JS-only / per-environment
// value changes, instead of a fast OTA update.
//
// Skipping the extra section keeps the native fingerprint stable across JS-only
// changes, so only genuine native changes (native deps, config plugins, app
// icons/scheme, SDK bumps) produce a new fingerprint and require a rebuild.
module.exports = {
  sourceSkips: ["ExpoConfigExtraSection"],
};
