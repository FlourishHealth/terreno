# create-terreno-app

Unscoped npm CLI that writes a deployable Terreno backend + Expo frontend to disk.

Operator walkthrough (Mongo replica set, seed, SDK, web, deploy): [Create a Terreno app](../how-to/create-a-terreno-app.md). First-run tutorial: [Getting started](../tutorials/getting-started.md).

## Install

```bash
bunx create-terreno-app my-app --display-name "My App"
```

npm (note the `--` before flags):

```bash
npm create terreno-app my-app -- --display-name "My App"
```

The published package name is `create-terreno-app`. Generated `@terreno/*`
dependencies pin `^<create-terreno-app version>`.

## CLI

```bash
bunx create-terreno-app <appName> --display-name <string> [--description <string>] [--mcp-server-url <url>] [--yes]
```

| Flag | Required | Default |
| --- | --- | --- |
| `appName` (positional) | yes | kebab-case (`^[a-z][a-z0-9-]*$`) |
| `--display-name` | unless `--yes` | derived from `appName` when `--yes` |
| `--description` | no | empty |
| `--mcp-server-url` | no | hosted Terreno MCP URL |
| `--yes` | no | off |

Writes `<cwd>/<appName>/`. Refuses a non-empty target except `.git` / `.gitignore`. Does not run `bun install`, Mongo, or seed.

Printed next steps install, seed, then start the backend. SDK and web run in a second terminal while the backend is up.

## Library

MCP `terreno_bootstrap_app` imports `generateAllFiles` and `writeScaffold` from this package. Hosted MCP never writes disk. Local MCP writes only when `targetDir` is an absolute path and `TERRENO_MCP_WRITE_SCAFFOLD=1`. See [MCP server](mcp-server.md).
