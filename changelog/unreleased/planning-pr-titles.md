---
category: Changed
---

Planning Brew titles are `[ticket] Short feature title`. The ticket uses the attached
Linear id (`[FH-1632]`) or GitHub issue (`[#412]`); the rest names the feature only.
Titles must not use `feat:` / `docs:` prefixes or lifecycle labels such as
`IP Approved` and `Task list`.

PR bodies now preserve the IP's initial justification and a brief overview of its
intended outcomes. Verification always includes reproducible testing instructions;
Brew updates that section as testing changes while keeping the rationale and overview
stable.
