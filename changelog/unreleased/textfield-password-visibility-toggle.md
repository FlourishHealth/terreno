---
category: Added
---

`TextField` with `type="password"` now renders a show/hide eye control so users can check what
they typed. The value starts masked, a disabled field cannot be revealed, and
`showVisibilityToggle={false}` removes the control. The toggle is reachable in tests at
`{testID}.visibility-toggle` (override with `testIDs.visibilityToggle`). `Field`, `LoginScreen`,
and `SignUpScreen` password fields inherit it.
