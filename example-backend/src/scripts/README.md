# Scripts

Utility scripts for development, migration, or one-off tasks go here.

Scripts can be run with:
```bash
bun run src/scripts/yourScript.ts
```

## Admin scripts as a CLI

Every script registered on the admin panel (see [`../adminScripts.ts`](../adminScripts.ts))
is also runnable from the command line via [`runAdminScript.ts`](./runAdminScript.ts).
This lets you (and AI assistants) run the exact same scripts that the admin UI
exposes, without going through HTTP.

```bash
# List all available admin scripts
bun run script --list

# Show a script's arguments
bun run script countRecords --help

# Dry run by default (no changes applied)
bun run script countRecords --model todos

# Apply changes with --wet
bun run script seedFeatureFlags --wet

# Machine-readable output for tooling
bun run script countRecords --json --model users
```

### Arguments

Scripts read arguments through `ctx.args` in a flexible way. The CLI accepts:

- `--name=value` or `--name value`
- `--flag` (boolean true) and `--no-flag` (boolean false)
- short aliases `-x`
- repeated flags (collected into an array)
- positional arguments (via `ctx.args.positional`)

Declare the args a script expects with the `args` field on its
`AdminScriptConfig` to get type coercion, defaults, validation, and help text.
The same arguments can be passed over HTTP (query params or a JSON body) when
running a script from the admin UI, so a script reads them identically no matter
how it was invoked. Reserved CLI flags (`--wet`, `--wetRun`, `--dry`, `--json`,
`--list`, `--help`/`-h`) control the runner and are not passed to the script.

## Example

```typescript
import { connectToMongoDB } from "../utils/database";
import { logger } from "@terreno/api";

const runScript = async (): Promise<void> => {
  await connectToMongoDB();
  
  logger.info("Running script");
  // Script logic here
  
  process.exit(0);
};

runScript();
```

