---
category: Changed
---

MCP create, update, and delete tools run through the same `executeCreate` /
`executeUpdate` / `executeDelete` pipeline as REST and Sync. Permission denials
and hook failures use `APIError` titles in the MCP error envelope. User-role
stripping happens after hooks in the executor (MCP uses the registry model
name). `loadDocOr404` maps invalid document `_id` values to 404, not populate
`CastError`s.
