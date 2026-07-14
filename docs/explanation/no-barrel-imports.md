# No barrel imports

Terreno avoids **barrel imports** — imports that resolve through an `index.ts` / `index.tsx` file that only re-exports other modules.

## Why

- **Clearer dependencies**: each import names the file that defines the symbol.
- **Faster tooling**: bundlers and TypeScript do less re-export chasing.
- **Fewer cycles**: internal barrels (especially package `index` files) are a common source of circular dependencies.

## Allowed

- **Published package APIs** — cross-package imports like `@terreno/api`, `@terreno/ui`, and `@terreno/rtk` use each package's public `src/index` entry. That is intentional.
- **Package public entry files** — `api/src/index.ts`, `ui/src/index.tsx`, etc. may re-export for npm consumers. Do not import those barrels from *inside* the same package.
- **Expo Router routes** — `app/**/index.tsx` files are route entries, not barrels.

## Not allowed

Importing a directory that resolves to a re-exporting index file:

```typescript
// Bad — resolves to models/index.ts
import {User} from "../models";

// Good — imports the defining module
import {User} from "../models/user";
```

```typescript
// Bad — store/index.ts was a barrel of sdk/appState/utils
import {useGetMeQuery} from "@/store";

// Good
import {useGetMeQuery} from "@/store/sdk";
import store, {useAppDispatch} from "@/store/index";
```

## Enforcement

- **CI**: `bun run check:no-barrel-imports` (see root `package.json` → `terreno.policies.noBarrelImports`)
- **AI rules**: `.rulesync/rules/00-root.md` and package `.ai/guidelines/core.md` files

When scaffolding new code (MCP bootstrap, examples), always generate direct module paths — never `models/index`, `@/store`, or `@components` without a concrete file.
