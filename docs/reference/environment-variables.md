# Environment Variables Reference

Comprehensive guide to environment variables used across Terreno packages and example applications.

## Table of Contents

- [@terreno/api (Backend)](#terrenoapi-backend)
- [@terreno/rtk (Frontend State)](#terrenortk-frontend-state)
- [@terreno/ui (Components)](#terrenoui-components)
- [@terreno/mcp-server (MCP Server)](#terrenomcp-server-mcp-server)
- [Example Backend](#example-backend)
- [Example Frontend](#example-frontend)

---

## @terreno/api (Backend)

Environment variables used by the `@terreno/api` package.

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TOKEN_SECRET` | ✅ | - | Secret key for signing JWT access tokens |
| `TOKEN_ISSUER` | ✅ | - | JWT issuer claim (e.g., `your-app.com`) |
| `REFRESH_TOKEN_SECRET` | ✅ | - | Secret key for signing refresh tokens |
| `SESSION_SECRET` | ✅ | - | Express session secret |
| `TOKEN_EXPIRES_IN` | ❌ | `15m` | Access token expiration (e.g., `1h`, `30m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | ❌ | `30d` | Refresh token expiration (e.g., `7d`, `90d`) |
| `SIGNUP_DISABLED` | ❌ | `false` | Disable user registration (invite-only mode) |

### GitHub OAuth (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | ❌ | - | GitHub OAuth application client ID |
| `GITHUB_CLIENT_SECRET` | ❌ | - | GitHub OAuth application client secret |
| `GITHUB_CALLBACK_URL` | ❌ | - | OAuth callback URL (e.g., `https://api.example.com/auth/github/callback`) |

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `3000` | HTTP server port |
| `NODE_ENV` | ❌ | `development` | Node environment (`development`, `production`, `test`) |
| `MONGO_URI` | ❌ | `mongodb://localhost:27017` | MongoDB connection string |
| `ENABLE_SWAGGER` | ❌ | `false` | Enable Swagger UI at `/swagger` endpoint |

### Logging & Monitoring

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | ❌ | - | Sentry DSN for error tracking |
| `USE_SENTRY_LOGGING` | ❌ | `false` | Send logs to Sentry |
| `LOG_REQUESTS` | ❌ | `false` | Log all HTTP requests |
| `LOG_SLOW_REQUESTS` | ❌ | `false` | Log requests exceeding threshold |
| `SLOW_REQUEST_THRESHOLD_MS` | ❌ | `5000` | Milliseconds to consider a request "slow" |
| `SLOW_DB_QUERY_THRESHOLD_MS` | ❌ | `100` | Milliseconds to consider a DB query "slow" |

### Webhooks & Notifications (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SLACK_WEBHOOKS` | ❌ | - | JSON object mapping names to Slack webhook URLs<br/>Example: `{"default": "https://hooks.slack.com/..."}` |
| `GOOGLE_CHAT_WEBHOOKS` | ❌ | - | JSON object mapping names to Google Chat webhook URLs<br/>Example: `{"default": "https://chat.googleapis.com/..."}` |
| `ZOOM_WEBHOOK` | ❌ | - | Zoom webhook URL for notifications |

### Google Cloud Platform (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT` | ❌ | - | Google Cloud project ID |
| `GCP_LOCATION` | ❌ | - | GCP region (e.g., `us-central1`) |
| `GCP_SERVICE_ACCOUNT_EMAIL` | ❌ | - | Service account email for authentication |
| `GCP_TASKS_NOTIFICATIONS_QUEUE` | ❌ | - | Cloud Tasks queue name for notifications |
| `GCP_TASK_PROCESSOR_QUEUE` | ❌ | - | Cloud Tasks queue name for background tasks |

### Caching & Performance

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VALKEY_URL` | ❌ | - | Redis/Valkey connection URL (e.g., `redis://localhost:6379`) |

### Other APIs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ❌ | - | Google Gemini API key for AI features |

### Example .env File

``````bash
# Required
TOKEN_SECRET=your-secret-key-change-this-in-production
TOKEN_ISSUER=your-app.com
REFRESH_TOKEN_SECRET=your-refresh-secret-change-this-too
SESSION_SECRET=your-session-secret-change-this-also
MONGO_URI=mongodb://localhost:27017/your-app

# Optional - Common in development
PORT=3000
NODE_ENV=development
ENABLE_SWAGGER=true
LOG_REQUESTS=true

# Optional - Production monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
USE_SENTRY_LOGGING=true
``````

---

## @terreno/rtk (Frontend State)

Environment variables used by the `@terreno/rtk` package and frontend applications.

### Base URL Configuration

The base URL is resolved in priority order:

1. `Constants.expoConfig?.extra?.BASE_URL` (production/staging builds)
2. `process.env.EXPO_PUBLIC_API_URL` (development web)
3. `Constants.expoConfig?.hostUri` + `:3000` (dev simulator/device)
4. `http://localhost:3000` (fallback)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | ❌ | Auto-detected | Backend API base URL<br/>Web: `http://localhost:3000`<br/>Simulator: Auto-detected via `hostUri`<br/>Device: Use your computer's local IP |

### Debug Flags

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_DEBUG` | ❌ | `false` | Enable authentication debug logging |
| `WEBSOCKETS_DEBUG` | ❌ | `false` | Enable WebSocket debug logging |

### Example app.json Configuration

``````json
{
  "expo": {
    "extra": {
      "BASE_URL": "https://api.example.com",
      "AUTH_DEBUG": "false",
      "WEBSOCKETS_DEBUG": "false"
    }
  }
}
``````

### Example .env for Web Development

``````bash
# Backend API URL
EXPO_PUBLIC_API_URL=http://localhost:4000
``````

---

## @terreno/ui (Components)

The `@terreno/ui` package **does not require environment variables**. All configuration is done at runtime via the `TerrenoProvider` component.

### Runtime Configuration

``````typescript
import {TerrenoProvider} from "@terreno/ui";

<TerrenoProvider
  initialTheme={{
    primitives: {
      primary500: "#0066CC",
      accent500: "#FF6B35",
    }
  }}
>
  <App />
</TerrenoProvider>
``````

---

## @terreno/mcp-server (MCP Server)

Environment variables used by the `@terreno/mcp-server` package.

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `8080` | HTTP server port |
| `MCP_HOST` or `HOST` | ❌ | `0.0.0.0` | Server host address |
| `NODE_ENV` | ❌ | `development` | Node environment (`development`, `production`, `test`) |
| `TERRENO_MCP_DOCS_DIR` | ❌ | `../docs` | Path to documentation directory (relative to dist/) |

### Error Tracking

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | ✅ (production)<br/>❌ (dev/test) | - | Sentry project DSN for error tracking |
| `APP_ENV` | ❌ | `development` | Sentry environment tag (`development`, `staging`, `production`) |
| `SENTRY_TRACES_SAMPLE_RATE` | ❌ | `0.1` | Performance traces sample rate (0.0–1.0) |

**Error Tracking Behavior:**

- **Production** (`NODE_ENV=production`): `SENTRY_DSN` is required. Server throws error on startup if missing.
- **Development/Test**: Sentry initializes as a no-op when `SENTRY_DSN` is not set.
- Exceptions are automatically captured in MCP request handlers and fatal startup errors.
- Performance tracing captures 10% of requests by default (configurable via `SENTRY_TRACES_SAMPLE_RATE`).

### Example .env File

``````bash
# Required in production
SENTRY_DSN=https://your-key@sentry.io/your-project

# Optional configuration
PORT=3001
HOST=localhost
APP_ENV=production
SENTRY_TRACES_SAMPLE_RATE=0.2
``````

---

## Example Backend

Environment variables specific to the example backend application (not part of @terreno/api).

### Application Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_ENV` | ❌ | `development` | Application environment (`development`, `staging`, `production`) |
| `BACKEND_SERVICE` | ❌ | `all` | Service type to run: `api`, `websockets`, `tasks`, or `all` |
| `API_URL` | ❌ | - | API service URL (for microservice architecture) |
| `TASKS_URL` | ❌ | - | Tasks service URL (for microservice architecture) |
| `FLOURISH_SERVICE` | ❌ | `flourish-backend` | Service name for OpenTelemetry tracing |

### WebSockets

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBSOCKET_PORT` | ❌ | Same as `PORT` | WebSocket server port (if separate from HTTP) |
| `FRONTEND_URL` | ❌ | Auto-detected | Frontend URL for CORS (e.g., `http://localhost:8082`) |

### Pull Request Environments

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PR_NUMBER` | ❌ | - | Pull request number (set by CI/CD) |
| `PR_SERVICE_URL` | ❌ | - | Cloud Run service URL base for PR environments |

### Performance Monitoring

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEMORY_SAMPLE_INTERVAL_MS` | ❌ | `60000` | Interval for memory usage sampling |
| `TRACE_SAMPLING_RATE` | ❌ | `0.1` | OpenTelemetry trace sampling rate (0.0-1.0) |

### Testing

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEST_MONGO_URI` | ❌ | `mongodb://localhost:27017/test` | MongoDB URI for tests |
| `CRON_SECRET_KEY` | ❌ | - | Secret key for testing cron endpoints |

### Configuration Model System

The example backend uses a **Configuration model** with a priority system:

**Priority (highest to lowest)**:
1. Runtime override via `Configuration.set()`
2. Database cache (persisted values)
3. Environment variable
4. Default value

``````typescript
// Get configuration value
const pageSize = await Configuration.get("DEFAULT_PAGE_SIZE"); // Returns 20

// Set configuration value (persists to database)
await Configuration.set("DEFAULT_PAGE_SIZE", 50);

// Register new configuration
Configuration.register("FEATURE_FLAG", {
  defaultValue: false,
  envVar: "FEATURE_FLAG",
  description: "Enable new feature",
  type: "boolean",
});
``````

See [Configuration System](../explanation/configuration-system.md) for details.

---

## Example Frontend

Environment variables specific to the example frontend application.

### SDK Generation

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAPI_URL` | ❌ | `http://localhost:4000/openapi.json` | Backend OpenAPI spec URL for SDK generation |

Used by `bun run sdk` to fetch the OpenAPI specification and generate RTK Query hooks.

### Development

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | ❌ | Auto-detected | Backend API URL (see [@terreno/rtk](#terrenortk-frontend-state)) |

### Example .env File

``````bash
# Backend API (optional - auto-detected if not set)
EXPO_PUBLIC_API_URL=http://localhost:4000

# SDK generation (optional)
OPENAPI_URL=http://localhost:4000/openapi.json
``````

---

## Best Practices

### Security

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use strong secrets** - Generate with `openssl rand -base64 32`
3. **Rotate secrets regularly** - Especially `TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`
4. **Different secrets per environment** - Don't reuse production secrets in development

### Development

1. **Use `.env.example`** - Check into version control with placeholder values
2. **Document all variables** - Include description and default values
3. **Validate required variables** - Fail fast if missing critical config
4. **Auto-detect when possible** - Like `@terreno/rtk` does for `BASE_URL`

### Production

1. **Use environment variables** - Not hardcoded values or `.env` files
2. **Set via platform** - Railway, Heroku, Cloud Run, etc.
3. **Enable monitoring** - Set `SENTRY_DSN` and `USE_SENTRY_LOGGING`
4. **Reduce logging** - Set `LOG_REQUESTS=false` to reduce noise

---

## Troubleshooting

### "TOKEN_SECRET is not set"

**Problem**: Required authentication variables missing.

**Solution**: 
```bash
cp .env.example .env
# Edit .env and set all required variables
```

### "Cannot connect to MongoDB"

**Problem**: `MONGO_URI` incorrect or MongoDB not running.

**Solutions**:
- Ensure MongoDB is running: `docker run -d -p 27017:27017 mongo`
- Check `MONGO_URI` in `.env`
- Test connection: `mongosh mongodb://localhost:27017`

### "Network request failed" (Frontend)

**Problem**: Frontend can't reach backend.

**Solutions**:
- Ensure backend is running
- Check `EXPO_PUBLIC_API_URL` matches backend port
- For physical devices: Use your computer's local IP, not `localhost`
- Verify CORS settings allow frontend origin

### "Invalid token"

**Problem**: Token secrets mismatch between frontend/backend.

**Solution**: Ensure `TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` are identical across deployments if using shared authentication.

---

## Related Documentation

- [Getting Started Tutorial](../tutorials/getting-started.md)
- [@terreno/api Reference](./api.md)
- [@terreno/rtk Reference](./rtk.md)
- [Configuration System](../explanation/configuration-system.md)
- [Example Backend README](../../example-backend/README.md)
- [Example Frontend README](../../example-frontend/README.md)
