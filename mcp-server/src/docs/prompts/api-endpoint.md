# Custom API Endpoint

Create a custom API endpoint with the following specifications:

## Endpoint Details
- **Method**: {{method}}
- **Path**: {{path}}
- **Description**: {{description}}

## Request
{{requestSection}}

## Response
{{responseSection}}

## Implementation Requirements

### Backend
1. Add route handler in appropriate route file
2. Use `asyncHandler` wrapper for async operations
3. Use `createOpenApiBuilder` for OpenAPI documentation
4. Add proper authentication middleware if needed
5. Validate request body/params
6. Return appropriate status codes

### Example Implementation
```typescript
import {asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";

router.{{methodLower}}("{{path}}", [
  authenticateMiddleware(),
  createOpenApiBuilder(options)
    .withTags(["{{tag}}"])
    .withSummary("{{description}}")
    {{parameterDocs}}
    .withResponse(200, {/* response schema */})
    .build(),
], asyncHandler(async (req, res) => {
  // Implementation
  return res.json({data: result});
}));
```

### Frontend Integration
1. Regenerate SDK: `bun run sdk`
2. Use generated hook in components
3. Handle loading and error states
