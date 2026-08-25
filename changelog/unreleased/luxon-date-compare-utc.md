---
category: Fixed
---

Sync mutation date equality now parses date-only ISO strings as UTC and rejects invalid input instead of throwing. The unused datetime NumberPicker stores UTC ISO so Luxon can round-trip the picker value.
