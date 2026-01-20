# Frontend Scripts

## generate-sdk.ts

Generates the RTK Query SDK from the OpenAPI specification.

This is a TypeScript script executed directly by Bun.

### What it does:

1. Runs the `@rtk-query/codegen-openapi` CLI using `tsx` (TypeScript executor)
2. Uses a custom TypeScript configuration (`tsconfig.codegen.json`) that's compatible with `ts-node`
3. Removes empty export statements that the codegen creates when there are no endpoints
4. Formats the generated file with Biome

### Usage:

```bash
bun run sdk
```

### Configuration:

- **Config file**: `openapi-config.ts` - Controls SDK generation settings
- **Output file**: `store/openApiSdk.ts` - Generated SDK file
- **OpenAPI source**: Configured in `openapi-config.ts` (defaults to `http://localhost:3000/openapi.json`)

### Troubleshooting:

If the script fails, ensure:
1. The backend is running (if using a local OpenAPI URL)
2. `tsx` is installed in devDependencies
3. `tsconfig.codegen.json` exists in the frontend root

