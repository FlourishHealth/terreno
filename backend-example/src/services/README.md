# Services

Business logic services go here. Services should:
- Throw user-friendly errors using `APIError` from @terreno/api
- Use logger.info/warn/error/debug for logging
- Use mongoose models for data access
- Be focused on a single domain or feature

## Example

```typescript
import { APIError } from "@terreno/api";
import { logger } from "@terreno/api";

export const exampleService = {
  doSomething: async (param: string): Promise<void> => {
    if (!param) {
      throw new APIError("Parameter is required", 400);
    }
    
    logger.info("Doing something with", param);
    // Business logic here
  },
};
```

