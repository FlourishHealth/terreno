# @terreno/api

REST API framework built on Express and Mongoose. Provides modelRouter (CRUD endpoints), JWT auth, permissions, and OpenAPI generation.

## Table of Contents

- [Authentication](#authentication)
- [Model Schema Conventions](#model-schema-conventions)
- [Mongoose Plugins](#mongoose-plugins)
- [Middleware](#middleware)
- [Webhooks & Notifications](#webhooks--notifications)
- [Utilities](#utilities)
- [Script Helpers](#script-helpers)

## Key exports

- `modelRouter`, `setupServer`, `Permissions`, `OwnerQueryFilter`
- `APIError`, `logger`, `asyncHandler`, `authenticateMiddleware`
- `createOpenApiBuilder`
- `githubUserPlugin`, `setupGitHubAuth`, `addGitHubAuthRoutes`
- Mongoose plugins: `findExactlyOne`, `findOneOrNone`, `upsertPlugin`, `DateOnly`
- Middleware: `openApiEtagMiddleware`, `sentryAppVersionMiddleware`
- Notifiers: `sendSlackMessage`, `sendGoogleChatMessage`, `sendZoomMessage`

## Authentication

@terreno/api includes built-in authentication with multiple strategies:

### Email/Password Authentication

JWT-based authentication using `passport-local-mongoose`:

``````typescript
import {setupServer} from "@terreno/api";

setupServer({
  userModel: User,
  authOptions: {
    generateJWTPayload: (user) => ({
      sub: user._id,
      admin: user.admin,
    }),
  },
});
``````

**Endpoints:**
- `POST /auth/signup` — Create user account
- `POST /auth/login` — Authenticate with email/password
- `POST /auth/refresh_token` — Refresh access token
- `GET /auth/me` — Get current user profile
- `PATCH /auth/me` — Update current user profile

**Environment variables:**
- `TOKEN_SECRET` — JWT signing secret (required)
- `TOKEN_ISSUER` — JWT issuer claim (required)
- `REFRESH_TOKEN_SECRET` — Refresh token secret (required)
- `SESSION_SECRET` — Express session secret (required)
- `TOKEN_EXPIRES_IN` — Token expiration (default: 15m)
- `REFRESH_TOKEN_EXPIRES_IN` — Refresh token expiration (default: 30d)

### GitHub OAuth Authentication

Add GitHub OAuth login to your API:

``````typescript
import {githubUserPlugin, setupServer} from "@terreno/api";

// Add GitHub fields to user schema
userSchema.plugin(githubUserPlugin);

setupServer({
  userModel: User,
  githubAuth: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL!,
    scope: ["user:email"],
    allowAccountLinking: true,
  },
});
``````

**Endpoints (when configured):**
- `GET /auth/github` — Initiate OAuth flow
- `GET /auth/github/callback` — OAuth callback handler
- `GET /auth/github/link` — Link GitHub to authenticated user (requires JWT)
- `DELETE /auth/github/unlink` — Unlink GitHub from account (requires JWT)

**Learn more:** [Add GitHub OAuth authentication](../how-to/add-github-oauth.md)

## Model Schema Conventions

### Required field descriptions

**Every field in a Mongoose schema must include a `description` property.** Descriptions are extracted by `mongoose-to-swagger` and included in the generated OpenAPI specification, making your API documentation and auto-generated SDK significantly more useful.

``````typescript
const schema = new mongoose.Schema<Document, Model>({
  title: {
    description: "The title of the item",
    type: String,
    required: true,
  },
  status: {
    description: "Current processing status",
    type: String,
    enum: ["pending", "active", "completed"],
    default: "pending",
  },
  ownerId: {
    description: "The user who owns this item",
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});
``````

### Writing good descriptions

- Keep them concise (one sentence is usually enough)
- Explain the field's purpose, not its type
- Use active voice: "The user who owns..." not "Owner of..."
- Include important constraints: "Email address (must be unique)"

### Benefits

Field descriptions appear in:
- OpenAPI spec at `/openapi.json`
- Generated SDK type definitions
- API documentation (Swagger UI if enabled)
- IDE autocomplete hints when using the SDK

## Mongoose Plugins

@terreno/api provides several Mongoose plugins to extend model functionality with common patterns.

### findExactlyOne & findOneOrNone

**Critical:** Never use `Model.findOne` directly. Use these plugins instead to prevent ambiguous queries.

``````typescript
import {findExactlyOne, findOneOrNone} from "@terreno/api";

// In your schema
todoSchema.plugin(findExactlyOne);
todoSchema.plugin(findOneOrNone);

// Usage
const todo = await Todo.findExactlyOne({_id: id}); // Throws if 0 or multiple found
const maybeUser = await User.findOneOrNone({email}); // Returns null if none, throws if multiple
``````

**Why these matter:**
- `findOne()` returns a **random document** if multiple match (non-deterministic)
- `findExactlyOne()` throws `APIError` (404) if none found, (500) if multiple found
- `findOneOrNone()` returns `null` if none found, throws (500) if multiple found

### upsertPlugin

Create or update a document atomically.

``````typescript
import {upsertPlugin, type HasUpsert} from "@terreno/api";

todoSchema.plugin(upsertPlugin);

// TypeScript: Extend your model interface
interface TodoModel extends DefaultModel<TodoDocument>, HasUpsert<TodoDocument> {}

// Usage
const todo = await Todo.upsert(
  {userId: user._id, taskId: task.id}, // Conditions
  {status: "completed", completedAt: new Date()} // Update
);
// Creates new if none exists, updates if found, throws if multiple match
``````

### DateOnly Schema Type

Custom Mongoose type for date-only fields (no time component).

``````typescript
import {Schema} from "mongoose";
import {DateOnly} from "@terreno/api";

// IMPORTANT: Register early in your app entry point (before models are loaded)
(Schema.Types as any).DateOnly = DateOnly;

// Then use in schemas
const eventSchema = new Schema({
  eventDate: {
    type: Schema.Types.DateOnly,
    description: "Date of the event (no time component)",
  },
});

// Automatically strips time when setting or fetching
event.eventDate = new Date("2026-02-15T14:30:00Z");
console.log(event.eventDate); // 2026-02-15T00:00:00.000Z
``````

**Features:**
- Automatically converts to UTC midnight
- Supports comparison operators (`$gt`, `$gte`, `$lt`, `$lte`)
- Throws `CastError` for invalid dates

### createdUpdatedPlugin

Adds `created` and `updated` timestamp fields with automatic management.

``````typescript
import {createdUpdatedPlugin} from "@terreno/api";

schema.plugin(createdUpdatedPlugin);

// Adds two fields:
// - created: Date (set on first save)
// - updated: Date (set on every save/update)

// Disable for specific saves
doc.disableCreatedUpdatedPlugin = true;
await doc.save();
``````

### isDeletedPlugin

Soft delete support with automatic query filtering.

``````typescript
import {isDeletedPlugin, type IsDeleted} from "@terreno/api";

schema.plugin(isDeletedPlugin, false); // Default: not deleted

// Adds:
// - deleted: boolean (default: false)
// - Automatic filtering in find() and findOne() queries

// Normal queries exclude deleted docs
const todos = await Todo.find({}); // Only non-deleted

// Explicitly query deleted docs
const deleted = await Todo.find({deleted: true});

// Soft delete
todo.deleted = true;
await todo.save();
``````

### isDisabledPlugin

Disable user accounts (returns 401 for disabled users).

``````typescript
import {isDisabledPlugin} from "@terreno/api";

userSchema.plugin(isDisabledPlugin, false);

// Adds disabled: boolean field
user.disabled = true;
await user.save();
// User will receive 401 on authentication attempts
``````

### baseUserPlugin

Base fields for user models.

``````typescript
import {baseUserPlugin, type BaseUser} from "@terreno/api";

userSchema.plugin(baseUserPlugin);

// Adds:
// - email: string (indexed)
// - admin: boolean (default: false)
``````

### firebaseJWTPlugin

Firebase authentication integration.

``````typescript
import {firebaseJWTPlugin} from "@terreno/api";

userSchema.plugin(firebaseJWTPlugin);

// Adds:
// - firebaseId: string (indexed)
``````

### Default Plugin Bundle

Many schemas use these together:

``````typescript
import {createdUpdatedPlugin, isDeletedPlugin, findExactlyOne, findOneOrNone} from "@terreno/api";

export const addDefaultPlugins = (schema) => {
  schema.plugin(createdUpdatedPlugin);
  schema.plugin(isDeletedPlugin);
  schema.plugin(findExactlyOne);
  schema.plugin(findOneOrNone);
};

// Apply to all schemas
todoSchema.plugin(addDefaultPlugins);
``````

## Middleware

### openApiEtagMiddleware

Adds ETag support to the `/openapi.json` endpoint for efficient caching.

``````typescript
import {openApiEtagMiddleware} from "@terreno/api";

// Add before OpenAPI middleware in setupServer
app.use(openApiEtagMiddleware);
``````

**Features:**
- Generates SHA-256 ETag from OpenAPI spec content
- Returns `304 Not Modified` when spec hasn't changed
- Reduces bandwidth for clients polling OpenAPI spec
- Automatically included in `setupServer()`

**Benefits:**
- SDK code generation tools can skip regeneration if spec unchanged
- Faster frontend builds in CI/CD pipelines
- Reduced server load for large OpenAPI specs

### sentryAppVersionMiddleware

Captures app version from request headers and adds to Sentry scope for error filtering.

``````typescript
import {sentryAppVersionMiddleware} from "@terreno/api";

app.use(sentryAppVersionMiddleware);
``````

**Expected header:** `App-Version: 1.2.3`

**Sentry tag:** `app_version: 1.2.3`

**Use case:** Filter Sentry errors by app version to identify version-specific bugs.

## Webhooks & Notifications

### Slack Notifications

``````typescript
import {sendSlackMessage} from "@terreno/api";

await sendSlackMessage({
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  message: "Deployment complete",
  blocks: [
    {
      type: "section",
      text: {type: "mrkdwn", text: "*Deployment Status*\nVersion 1.2.3 deployed successfully"},
    },
  ],
});
``````

### Google Chat Notifications

``````typescript
import {sendGoogleChatMessage} from "@terreno/api";

await sendGoogleChatMessage({
  webhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL,
  message: "Build failed",
  sections: [
    {
      header: "Build Status",
      widgets: [{textParagraph: {text: "Branch: main\nStatus: Failed"}}],
    },
  ],
});
``````

### Zoom Notifications

``````typescript
import {sendZoomMessage} from "@terreno/api";

await sendZoomMessage({
  webhookUrl: process.env.ZOOM_WEBHOOK_URL,
  message: "Server health alert",
});
``````

**Common use cases:**
- CI/CD pipeline notifications
- Error alerts
- Deployment confirmations
- Health check failures

## Utilities

### checkModelsStrict

Validates all registered Mongoose models use strict mode and virtual settings.

``````typescript
import {checkModelsStrict} from "@terreno/api";

// Run in non-production environments at startup
if (process.env.NODE_ENV !== "production") {
  checkModelsStrict();
}
``````

**Checks:**
- `strict: "throw"` or `strict: true` (prevents accidental field additions)
- `toJSON: {virtuals: true}` (includes virtual fields in JSON output)
- `toObject: {virtuals: true}` (includes virtual fields in plain objects)

**Throws:** Detailed error listing all non-compliant models

**Why:** Prevents subtle bugs from schema misconfigurations that only appear in production.

### isValidObjectId

Better ObjectId validation than Mongoose's built-in validator.

``````typescript
import {isValidObjectId} from "@terreno/api";

// Mongoose's isValidObjectId has false positives
console.log(mongoose.isValidObjectId("123456789012")); // true (wrong!)

// @terreno/api's version correctly validates
console.log(isValidObjectId("123456789012")); // false (correct)
console.log(isValidObjectId("507f1f77bcf86cd799439011")); // true
``````

**Fix:** Checks length is exactly 24 hex characters, not just 12+ characters.

### timeout

Promise-based timeout utility.

``````typescript
import {timeout} from "@terreno/api";

// Wait 1 second
await timeout(1000);

// Use in retry logic
for (let i = 0; i < 3; i++) {
  try {
    await someOperation();
    break;
  } catch (error) {
    if (i < 2) await timeout(1000 * Math.pow(2, i)); // Exponential backoff
  }
}
``````

## Script Helpers

### wrapScript

Error handling wrapper for scripts and cron jobs.

``````typescript
import {wrapScript} from "@terreno/api";

wrapScript(async () => {
  // Your script logic
  await processData();
  console.log("Script completed successfully");
});
``````

**Features:**
- Catches and logs exceptions via `logger.catch()`
- Sends errors to Sentry
- Exits with code 1 on error, 0 on success
- Ensures process doesn't hang on uncaught errors

### cronjob

Schedule recurring tasks with error handling.

``````typescript
import {cronjob} from "@terreno/api";

// Run every hour
cronjob("0 * * * *", async () => {
  await cleanupOldData();
}, {
  name: "Cleanup Job",
  runOnInit: false, // Run immediately on start?
});
``````

**Features:**
- Uses `node-cron` syntax
- Automatic error logging
- Named jobs for monitoring
- Optional immediate execution

**Cron syntax:** `"minute hour day month weekday"`
- `"*/5 * * * *"` — Every 5 minutes
- `"0 0 * * *"` — Daily at midnight
- `"0 */6 * * *"` — Every 6 hours

## Deprecations

### transformer (modelRouter option)

**Deprecated:** Use lifecycle hooks instead (`preCreate`, `postCreate`, etc.)

``````typescript
// Old (deprecated)
modelRouter(Model, {
  transformer: (doc) => ({...doc, computed: true}),
});

// New (use responseHandler)
modelRouter(Model, {
  responseHandler: (doc, method) => ({...doc, computed: true}),
});
``````

### responseSerializer (modelRouter option)

**Deprecated:** Use `responseHandler` instead.

``````typescript
// Old (deprecated)
modelRouter(Model, {
  responseSerializer: (doc) => serialize(doc),
});

// New
modelRouter(Model, {
  responseHandler: (doc, method) => serialize(doc),
});
``````

## Learn more

- [How to create a model](../how-to/create-a-model.md)
- [Add GitHub OAuth](../how-to/add-github-oauth.md)
- [Authentication architecture](../explanation/authentication.md)
- [API package source](../../api/src/)
- [AI assistant rules](./.cursor/rules/api/)
