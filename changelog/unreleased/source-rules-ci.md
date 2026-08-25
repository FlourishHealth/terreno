---
category: Added
---

CI now fails production TypeScript that uses `function` declarations, `Date`/`Date.now()`, `throw new Error`, `console.log`, Mongoose `findOne`, or unsuppressed `as any`. Run `bun run check:source-rules`.
