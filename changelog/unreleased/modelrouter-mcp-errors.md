---
category: Fixed
---

- MCP create/update apply REST `validation.excludeFromCreate` /
  `excludeFromUpdate` and MCP `excludeFields` as a write denylist on both the
  persist payload and the fake request body passed to lifecycle hooks, including
  nested/dot paths, matching HTTP body validation and the fields hidden from
  tool schemas
- MCP read/update/delete return a structured not-found error for invalid
  ObjectIds instead of crashing on Mongoose `CastError`, while still accepting
  mixed-case 24-hex ids the way REST `findById` does
- MCP list returns a structured error when `queryFilter` throws, matching REST
  400 handling
- MCP create/update drop literal dotted keys that match a denylist path so
  Mongoose cannot treat `"metadata.nested.token"` as a nested write
- MCP list/read/create/update return a structured tool error when a
  `responseHandler` or `mcpResponseHandler` throws, instead of crashing the
  MCP protocol call
