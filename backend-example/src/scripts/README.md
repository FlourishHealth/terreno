# Scripts

Utility scripts for development, migration, or one-off tasks go here.

Scripts can be run with:
```bash
bun run src/scripts/yourScript.ts
```

## Example

```typescript
import { connectToMongoDB } from "../utils/database";
import { logger } from "../utils/logger";

const runScript = async (): Promise<void> => {
  await connectToMongoDB();
  
  logger.info("Running script");
  // Script logic here
  
  process.exit(0);
};

runScript();
```

