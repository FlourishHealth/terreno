// Fingerprint configuration for the Expo native runtime.
//
// `runtimeVersion.policy: "fingerprint"` (app.json) ties the OTA-update runtime
// version — and the CI "needs a new dev build?" check — to this fingerprint.
// The `extra` section of the Expo config only holds JS-runtime values (EAS
// projectId, router config, etc.) that ship inside the JS bundle via EAS Update
// and never alter the compiled native binary. Skipping it keeps the native
// fingerprint stable across JS-only changes so only genuine native changes
// (native deps, config plugins, app icons/scheme, SDK bumps) require a rebuild.
module.exports = {
  sourceSkips: ["ExpoConfigExtraSection"],
};
