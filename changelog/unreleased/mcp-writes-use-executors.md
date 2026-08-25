---
category: Changed
---

MCP create, update, and delete tools run through the same `executeCreate` /
`executeUpdate` / `executeDelete` pipeline as REST and Sync. Permission denials
and hook failures use `APIError` titles in the MCP error envelope.
