---
category: Fixed
---

`TextField` on React Native Web no longer enters an update-depth loop when
browser autocorrect alternates controlled values. Web autocorrect/spellcheck is
disabled, the input handler stays stable, and rapid synthetic A→B→A reversals
are suppressed without blocking normal typing or delayed backspace/retype.
