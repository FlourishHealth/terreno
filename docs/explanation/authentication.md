# Authentication Architecture

Understanding how authentication works in @terreno/api — from JWT tokens to OAuth strategies to automatic token refresh.

## Overview

@terreno/api provides a complete authentication system built on:
- **JWT (JSON Web Tokens)** for stateless session management
- **Passport.js** for authentication strategy management
- **Multiple strategies**: Email/password, GitHub OAuth, Anonymous
- **Automatic token refresh** to maintain long-lived sessions
- **Token storage utilities** for secure frontend storage (via @terreno/rtk)

## Authentication Strategies

### Email/Password (Local Strategy)

Traditional username/password authentication using `passport-local-mongoose`.

**Flow:**
1. User signs up with email and password
2. Password is hashed with pbkdf2 (via passport-local-mongoose)
3. User logs in with credentials
4. Backend validates password and issues JWT tokens
5. Frontend includes JWT in `Authorization` header for subsequent requests

**Endpoints:**
- `POST /auth/signup` — Create new user account
- `POST /auth/login` — Authenticate and receive tokens

### GitHub OAuth Strategy

OAuth 2.0 authentication with GitHub.

**Flow:**
1. User clicks "Sign in with GitHub"
2. Frontend redirects to `GET /auth/github?returnTo=<url>`
3. Backend redirects to GitHub authorization page
4. User grants permissions on GitHub
5. GitHub redirects back to `GET /auth/github/callback`
6. Backend verifies authorization code with GitHub
7. Backend finds/creates user, issues JWT tokens
8. Backend redirects to `returnTo` URL with tokens as query params

**Account Linking:**
- Authenticated users can link their GitHub account via `GET /auth/github/link`
- Multiple authentication methods can be attached to one user account
- Users must have a password set before unlinking GitHub

**Learn more:** [How to add GitHub OAuth](../how-to/add-github-oauth.md)

### Better Auth Strategy

Modern authentication provider supporting social OAuth (Google, GitHub, Apple) and email/password authentication.

**Flow:**
1. User initiates authentication (social login or email/password)
2. For social login: Better Auth redirects to OAuth provider → user authorizes → callback
3. Better Auth creates/finds user and establishes session
4. Session stored securely on frontend (expo-secure-store on mobile, AsyncStorage on web)
5. Session automatically included in API requests
6. Frontend Redux state updated with user information

**Providers:**
- **Google OAuth** — Sign in with Google
- **GitHub OAuth** — Sign in with GitHub  
- **Apple OAuth** — Sign in with Apple
- **Email/Password** — Traditional authentication

**Key Differences from JWT:**
- Supports multiple social OAuth providers out of the box
- Built-in mobile deep link support for Expo/React Native
- Automatic session management with secure storage
- Modern API design

**Use Better Auth when:**
- Building new applications
- Need Google or Apple OAuth
- Want simplified mobile authentication
- Prefer modern authentication patterns

**Use JWT/Passport when:**
- Maintaining existing applications
- Need custom authentication flows
- Want fine-grained control over tokens

Both systems can run in parallel. See [Add Better Auth](../how-to/add-better-auth.md) for setup.

### Anonymous Strategy

Allows limited access without authentication.

**Use case:** Public read access to certain resources while requiring authentication for writes.

``````typescript
import {Permissions} from "@terreno/api";

modelRouter(Model, {
  permissions: {
    list: [Permissions.IsAuthenticatedOrReadOnly],
    read: [Permissions.IsAuthenticatedOrReadOnly],
    create: [Permissions.IsAuthenticated],
  },
});
``````

## JWT Token System

### Token Types

**Access Token (short-lived)**
- Default expiration: 15 minutes (`TOKEN_EXPIRES_IN`)
- Used for API requests
- Included in `Authorization: Bearer <token>` header
- Contains user ID and permissions in payload

**Refresh Token (long-lived)**
- Default expiration: 30 days (`REFRESH_TOKEN_EXPIRES_IN`)
- Used only to obtain new access tokens
- Stored securely on client
- Cannot be used for API requests

### Token Payload

Access tokens contain:

``````json
{
  "sub": "507f1f77bcf86cd799439011",  // User ID
  "admin": false,                      // Admin status
  "iat": 1709000000,                   // Issued at (timestamp)
  "exp": 1709000900,                   // Expires at (timestamp)
  "iss": "your-app-name"               // Issuer (from TOKEN_ISSUER env var)
}
``````

Customize the payload with `authOptions.generateJWTPayload`:

``````typescript
setupServer({
  authOptions: {
    generateJWTPayload: (user) => ({
      sub: user._id,
      admin: user.admin,
      role: user.role,  // Custom field
    }),
  },
});
``````

### Token Refresh Flow

1. Access token expires (after 15 minutes)
2. API request returns `401 Unauthorized`
3. Frontend middleware detects 401
4. Frontend calls `POST /auth/refresh_token` with refresh token
5. Backend validates refresh token
6. Backend issues new access token and refresh token
7. Frontend retries original request with new token

This is handled automatically by @terreno/rtk's `emptyApi` configuration.

## Frontend Integration

### Redux Store Setup (with @terreno/rtk)

``````typescript
import {generateAuthSlice} from "@terreno/rtk";
import {configureStore} from "@reduxjs/toolkit";
import {openapi} from "./openApiSdk";

const {authReducer, middleware, logout} = generateAuthSlice(openapi);

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [openapi.reducerPath]: openapi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(openapi.middleware, ...middleware),
});
``````

**What this provides:**
- Automatic token storage (SecureStore on mobile, AsyncStorage on web)
- Token refresh middleware
- Login/logout state management
- Auth header injection for all API requests

### Token Storage

**Mobile (iOS/Android):**
- Uses `expo-secure-store` for encrypted storage
- Tokens stored in device keychain

**Web:**
- Uses `@react-native-async-storage/async-storage`
- Falls back to localStorage
- SSR-safe (checks `typeof window`)

**Storage keys:**
- `AUTH_TOKEN` — Access token
- `REFRESH_TOKEN` — Refresh token

## Permission System

Permissions control access to modelRouter endpoints.

### Built-in Permissions

| Permission | Description |
|-----------|-------------|
| `IsAny` | Always allows (public access) |
| `IsAuthenticated` | Requires valid JWT (non-anonymous) |
| `IsAdmin` | Requires `user.admin === true` |
| `IsOwner` | Requires admin or `obj.ownerId === user.id` |
| `IsAuthenticatedOrReadOnly` | Auth required for writes, anyone can read |
| `IsOwnerOrReadOnly` | Owner or admin for writes, anyone can read |

### Permission Evaluation

Permissions are evaluated as an **AND** operation — all permissions in the array must return `true`:

``````typescript
permissions: {
  update: [Permissions.IsAuthenticated, Permissions.IsOwner],
  // Both conditions must be true
}
``````

### Custom Permissions

Create custom permission functions:

``````typescript
const IsPremiumUser = (user, obj, method) => {
  return user?.subscription === "premium";
};

modelRouter(Model, {
  permissions: {
    create: [Permissions.IsAuthenticated, IsPremiumUser],
  },
});
``````

## Security Best Practices

### Backend

✅ **Do:**
- Use environment variables for secrets (`TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`)
- Set strong, unique secrets in production (at least 32 characters)
- Use HTTPS in production
- Validate token issuer (`TOKEN_ISSUER`)
- Set appropriate token expiration times
- Implement rate limiting on auth endpoints
- Log authentication failures

❌ **Don't:**
- Commit secrets to version control
- Use the same secret for tokens and refresh tokens
- Store sensitive data in JWT payload (it's base64, not encrypted)
- Allow infinite token lifetimes

### Frontend

✅ **Do:**
- Use SecureStore on mobile for token storage
- Clear tokens on logout
- Handle token expiration gracefully
- Show user feedback during auth flows
- Validate tokens before making authenticated requests

❌ **Don't:**
- Store tokens in localStorage on web (use httpOnly cookies in production)
- Log tokens to console
- Send tokens in URL query parameters
- Ignore token refresh failures

## Environment Variables

Required for authentication:

``````bash
# JWT Configuration
TOKEN_SECRET=your-secret-key-min-32-chars
TOKEN_ISSUER=your-app-name
REFRESH_TOKEN_SECRET=different-secret-key-min-32-chars
SESSION_SECRET=session-secret-min-32-chars

# Optional: Custom expiration times
TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# GitHub OAuth (if using)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:4000/auth/github/callback

# Optional: Disable user registration
SIGNUP_DISABLED=false
``````

## Authentication Middleware

### Protecting Routes

Use `authenticateMiddleware()` to require authentication:

``````typescript
import {authenticateMiddleware, asyncHandler} from "@terreno/api";

router.get("/protected", [
  authenticateMiddleware(),
  asyncHandler(async (req, res) => {
    // req.user is populated with authenticated user
    const userId = req.user?._id;
    return res.json({userId});
  }),
]);
``````

### Anonymous Access

Allow unauthenticated requests but populate `req.user` if token is present:

``````typescript
router.get("/public", [
  authenticateMiddleware({anonymous: true}),
  asyncHandler(async (req, res) => {
    // req.user is populated if token provided, undefined otherwise
    const isLoggedIn = !!req.user;
    return res.json({isLoggedIn});
  }),
]);
``````

## Troubleshooting

### "Invalid token"

- Token has expired — frontend should refresh
- Token signature invalid — check `TOKEN_SECRET` matches
- Token issuer mismatch — verify `TOKEN_ISSUER` is correct

### "No auth token provided"

- Missing `Authorization` header
- Header format incorrect (should be `Bearer <token>`)

### Token refresh fails

- Refresh token expired — user must log in again
- `REFRESH_TOKEN_SECRET` mismatch between token creation and validation
- Refresh token revoked (user logged out)

### User logged out unexpectedly

- Access token expired and refresh failed
- Backend `TOKEN_SECRET` changed (invalidates all tokens)
- Token storage cleared (app reinstall, cache clear)

## Advanced Topics

### Custom User Fields in Token

Add custom fields to JWT payload:

``````typescript
setupServer({
  authOptions: {
    generateJWTPayload: (user) => ({
      sub: user._id,
      admin: user.admin,
      organizationId: user.organizationId,
      roles: user.roles,
    }),
  },
});
``````

### Multi-Tenant Authentication

Scope users to organizations:

``````typescript
const queryFilter = (user, _query) => ({
  organizationId: user?.organizationId,
});

modelRouter(Model, {
  permissions: {list: [Permissions.IsAuthenticated]},
  queryFilter,
});
``````

### Webhook Authentication

Verify webhook signatures instead of JWT:

``````typescript
import crypto from "crypto";

router.post("/webhook", asyncHandler(async (req, res) => {
  const signature = req.headers["x-signature"];
  const payload = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(payload)
    .digest("hex");
  
  if (signature !== expected) {
    throw new APIError({status: 401, title: "Invalid signature"});
  }
  
  // Process webhook
}));
``````

## Learn More

- [Add GitHub OAuth](../how-to/add-github-oauth.md)
- [Create a model](../how-to/create-a-model.md)
- [API reference](../reference/api.md)
- [@terreno/rtk reference](../reference/rtk.md)
