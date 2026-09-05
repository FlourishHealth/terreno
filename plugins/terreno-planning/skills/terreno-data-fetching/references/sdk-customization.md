# SDK Customization — Terreno

## Generated vs hand-maintained

| File | Editable? | Purpose |
|------|-----------|---------|
| `store/openApiSdk.ts` | **Never** | Auto-generated hooks from OpenAPI |
| `store/sdk.ts` | **Yes** | Extensions, cache tags, custom endpoints |
| `openapi-config.ts` | **Yes** | Codegen configuration |

## injectEndpoints

Add app-specific endpoints that are not in the OpenAPI spec (rare — prefer backend routes):

```tsx
import {openapi} from "./openApiSdk";

export const terrenoApi = openapi
  .injectEndpoints({
    endpoints: (build) => ({
      getMe: build.query({
        query: () => "/auth/me",
        providesTags: ["profile"],
      }),
      patchMe: build.mutation({
        query: (body) => ({
          url: "/auth/me",
          method: "PATCH",
          body,
        }),
        invalidatesTags: ["profile"],
      }),
    }),
  })
  .enhanceEndpoints({
    addTagTypes: ["todos", "users", "profile"],
  });
```

Import hooks from `@/store/sdk`, not `@/store/openApiSdk` directly.

## Cache tags

Use `enhanceEndpoints` to add tag types, then `providesTags` / `invalidatesTags` in injected endpoints:

```tsx
import {invalidatesIdTags, providesIdTags} from "@terreno/rtk";

// In injectEndpoints:
listItems: build.query({
  query: (params) => ({url: "/items", params}),
  providesTags: providesIdTags("items"),
}),
createItem: build.mutation({
  query: (body) => ({url: "/items", method: "POST", body}),
  invalidatesTags: invalidatesIdTags("items"),
}),
```

## Codegen config

```typescript
// openapi-config.ts
const config: ConfigFile = {
  apiFile: "@terreno/rtk",
  apiImport: "emptySplitApi",
  outputFile: "./store/openApiSdk.ts",
  schemaFile: "http://localhost:4000/openapi.json",
  hooks: true,
  tag: true,
  flattenArg: true,
};
```

Override schema URL with `OPENAPI_URL` env var when needed.

## Workflow after backend change

1. Start backend (`bun run backend:dev`)
2. Run `cd example-frontend && bun run sdk`
3. Import new hooks from `@/store/sdk`
4. If the endpoint needs custom cache behavior, update `sdk.ts`

See the `generate-sdk` skill for the full procedure.
