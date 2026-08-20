---
category: Fixed
---

MCP create/update apply REST `validation.excludeFromCreate` /
`excludeFromUpdate` and MCP `excludeFields` as a write denylist on persist and
hook request bodies, including nested/dot paths and literal dotted keys
(`"metadata.nested.token"`). Invalid ObjectIds return a structured not-found
instead of crashing on `CastError`; mixed-case 24-hex ids still work. List
returns a structured error when `queryFilter` throws. A throwing
`responseHandler` / `mcpResponseHandler` becomes a structured tool error instead
of a protocol crash. List filters ignore queryFields that sit under an
`excludeFields` parent path, matching tool schema generation. Lifecycle hooks
that throw `APIError` return `error.title` to the MCP client, matching
`queryFilter` handling.
