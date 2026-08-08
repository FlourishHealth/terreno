# Expose Model Context Protocol Tools

Turn a `modelRouter` model into Model Context Protocol (MCP) tools that an LLM can call, reusing the permissions, query filters, population, and lifecycle hooks you already declared for REST.

## Prerequisites

- A working Terreno backend using `TerrenoApp`
- At least one model registered with `modelRouter`

## Steps

### 1. Add an `mcp` config to a model router

```typescript
import {modelRouter, OwnerQueryFilter, Permissions} from "@terreno/api";

export const todoRouter = modelRouter("/todos", Todo, {
  mcp: {
    excludeFields: ["internalNote"],
    maxLimit: 25,
    methods: ["list", "read", "create", "update", "delete"],
  },
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsOwner],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsOwner],
    update: [Permissions.IsOwner],
  },
  queryFields: ["completed", "title"],
  queryFilter: OwnerQueryFilter,
});
```

`methods` defaults to `["list", "read"]`, and `maxLimit` defaults to 50. A method whose `permissions` array is empty is never exposed as a tool, so REST and MCP cannot drift apart.

### 2. Start the server

`TerrenoApp` mounts `POST /mcp` automatically as soon as any model has an `mcp` config. Every other verb on `/mcp` returns a JSON-RPC 405. No extra registration is needed.

Tools are named `{prefix}_{method}` — `todos_list`, `todos_read`, and so on.

### 3. Call the tools

Point any MCP client at `POST /mcp` with the user's `Authorization: Bearer <token>` header. Both JWT and Better Auth sessions are accepted; the resolved user is what the permission checks run against, so an LLM can never see more than that user could see over REST.

Authentication is required by default, matching REST. A tool call with no resolvable user is refused before any permission check unless the model router sets `allowAnonymous: true` — the same flag REST passes to `authenticateMiddleware`. That matters for read-only helpers like `IsAuthenticatedOrReadOnly`, which would otherwise pass for an anonymous `list`. Disabled accounts are refused too, as they are over HTTP.

To run the same tools in-process (for example inside a chat route), use `getMCPTools`:

```typescript
import {getMCPTools} from "@terreno/api";

const tools = getMCPTools(req.user);
```

## Naming tools

The default prefix is the lowercase model name run through a simple pluralizer: `Todo` → `todos`, `Category` → `categories`, `Status` → `statuses`. Irregular nouns need an explicit prefix:

```typescript
mcp: {toolPrefix: "people"} // person_list -> people_list
```

## Filtering list results

Only fields listed in `queryFields` can be filtered, exactly as in REST. A filter value may be an exact value or an operator object:

```json
{"completed": false, "title": {"$in": ["Buy milk", "Walk dog"]}}
```

Allowed operators are `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$all`, `$size`, `$exists`, and `$regex` (with `$options`). Operators that can execute code or ignore indexes — `$where`, `$expr`, `$function`, `$accumulator`, `$jsonSchema`, `$text` — are rejected with an error rather than silently dropped, so the model can correct itself.

Filters can be combined with top-level `$and` / `$or`, whose branches are validated against `queryFields` too:

```json
{"$or": [{"completed": true}, {"title": {"$regex": "^Urgent"}}]}
```

`queryFilter` still runs after the filter is built, so an `OwnerQueryFilter` keeps scoping results to the calling user no matter what the LLM sends.

## Populating references

Population comes from the model router's `populatePaths`, exactly as it does over REST. A tool may pass `populate` to request a **subset** of those declared paths — it can never introduce a new one, so the `fields` allowlist on each declared path always applies and a caller cannot pull back a whole referenced document:

```typescript
populatePaths: [{fields: ["name", "email"], path: "ownerId"}],
```

`{"populate": "ownerId"}` is accepted; anything undeclared is refused with an error listing the allowed paths. Models with no `populatePaths` don't get a `populate` parameter at all.

## Hiding fields

`excludeFields` removes fields from both the generated tool schemas and the responses:

- A bare name (`"hash"`) is removed at **every depth**, including inside arrays and populated refs, so a redacted name cannot leak through a nested document.
- A dot path (`"metadata.secretKey"`) removes exactly that location, following arrays of subdocuments element-wise.

## Customizing responses

`mcpResponseHandler` shapes MCP responses independently of the REST `responseHandler`, which is useful for returning compact summaries to an LLM:

```typescript
mcp: {
  mcpResponseHandler: async (value, method) => {
    if (Array.isArray(value)) {
      return value.map((todo) => ({id: String(todo._id), title: todo.title}));
    }
    return {id: String(value._id), title: value.title};
  },
}
```

`excludeFields` is applied after your handler runs.

## Lifecycle hooks

`preCreate`, `postCreate`, `preUpdate`, `postUpdate`, `preDelete`, and `postDelete` all run for MCP calls. An MCP tool call is JSON-RPC rather than HTTP, so the `request` argument is an Express-shaped object with the authenticated `user`, the tool arguments as `body`, empty `query`/`params`/`headers`, and `isMCPRequest: true`:

```typescript
preCreate: (body, req) => {
  if ((req as unknown as {isMCPRequest?: boolean}).isMCPRequest) {
    // e.g. tag records created by an assistant
    return {...body, source: "assistant"};
  }
  return body;
},
```

A hook that reads `req.headers` or `req.query` gets an empty object instead of a crash, but anything genuinely HTTP-specific (cookies, IP address) is unavailable — branch on `isMCPRequest` when that matters.
