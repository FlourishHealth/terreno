# Unreleased changelog fragments

Add **one Markdown file per feature** here. Do not edit `CHANGELOG.md`
`## [Unreleased]` — that shared section is what caused merge conflicts.

## File name

Kebab-case, describing the feature: `sendgrid-mail-provider.md`.

Do not use `README.md` (this file) or a name that is not kebab-case.

## Header

Every file starts with this YAML header. `category` must be one of
`Breaking`, `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`.

```markdown
---
category: Added
---

User-facing description of the change. Prose is turned into a changelog
bullet. A Markdown list is kept as-is.
```

## Preview and release

```bash
bun run changelog:preview
bun run changelog:assemble 57.1.0
bun run check:changelog
```

`changelog:assemble` folds these files into a dated `CHANGELOG.md` section
and deletes the assembled fragments. Run it only when cutting a release.
