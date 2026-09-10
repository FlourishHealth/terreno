# create-terreno-app

Generates a full-stack Terreno application scaffold (backend, frontend, CI, MCP config).

## CLI

```bash
bunx create-terreno-app <appName> --display-name "My App"
npm create terreno-app <appName> -- --display-name "My App"
```

| Flag | Required | Default |
| --- | --- | --- |
| `appName` (positional) | yes | — (kebab-case directory and package name) |
| `--display-name` | unless `--yes` | derived from `appName` when `--yes` |
| `--description` | no | empty |
| `--mcp-server-url` | no | `https://mcp.terreno.flourish.health` |
| `--yes` | no | off |

The CLI writes `<cwd>/<appName>/` and refuses to overwrite a target that already contains anything other than `.git` or `.gitignore`. It does not run `bun install` or seed scripts.

## Library exports

- `generateAllFiles` — returns the scaffold file list (used by MCP)
- `writeScaffold` — writes the scaffold to disk
