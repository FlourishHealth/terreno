# Add Better Auth Authentication

Add modern OAuth authentication to your @terreno/api backend with Better Auth. Supports Google, GitHub, and Apple social login plus email/password authentication.

## What is Better Auth?

Better Auth is an optional authentication provider that offers:
- **Social OAuth**: Google, GitHub, Apple
- **Email/password**: Traditional authentication
- **Mobile-first**: Deep link support for Expo/React Native apps
- **Modern**: Built for contemporary web and mobile apps

Use Better Auth **instead of** or **alongside** the traditional JWT/Passport authentication system.

## Prerequisites

- Existing @terreno/api backend with `TerrenoApp` or `setupServer()` configured
- User model with Mongoose schema
- OAuth credentials from Google/GitHub/Apple (see [Creating OAuth Apps](#creating-oauth-apps))

## Step 1: Add Better Auth Fields to User Model

Add Better Auth fields to your user schema:

``````typescript
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    description: "User's email address",
    type: String,
    unique: true,
  },
  name: {
    description: "User's display name",
    type: String,
  },
  admin: {
    description: "Whether the user has admin privileges",
    type: Boolean,
    default: false,
  },
  // Better Auth fields
  betterAuthId: {
    description: "Better Auth user ID",
    type: String,
    index: true,
  },
  oauthProvider: {
    description: "OAuth provider name (google, github, apple)",
    type: String,
  },
});

export const User = mongoose.model("User", userSchema);
``````

## Step 2: Configure Better Auth

Create a Better Auth configuration and register the plugin with TerrenoApp:

``````typescript
import {BetterAuthApp, type BetterAuthConfig, TerrenoApp} from "@terreno/api";
import {User} from "./models/user";

const betterAuthConfig: BetterAuthConfig = {
  enabled: true,
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  basePath: "/api/auth",  // Optional, defaults to "/api/auth"
  trustedOrigins: ["terreno://", "exp://"],  // For Expo deep links
  googleOAuth: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  githubOAuth: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  },
  appleOAuth: {
    clientId: process.env.APPLE_CLIENT_ID!,
    clientSecret: process.env.APPLE_CLIENT_SECRET!,
  },
};

const app = new TerrenoApp({
  userModel: User,
  plugins: [
    new BetterAuthApp({config: betterAuthConfig, userModel: User}),
  ],
});

app.start();
``````

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `enabled` | boolean | Yes | Enable Better Auth |
| `secret` | string | Yes | Session encryption secret (min 32 chars) |
| `baseURL` | string | Yes | Base URL of your API (e.g., `https://api.yourapp.com`) |
| `basePath` | string | No | Auth routes path prefix (default: `/api/auth`) |
| `trustedOrigins` | string[] | No | Allowed origins for OAuth redirects (mobile deep links) |
| `googleOAuth` | object | No | Google OAuth configuration |
| `githubOAuth` | object | No | GitHub OAuth configuration |
| `appleOAuth` | object | No | Apple OAuth configuration |

Each OAuth provider config requires `clientId` and `clientSecret`.

## Step 3: Set Environment Variables

Add these to your `.env` file:

``````bash
# Better Auth
AUTH_PROVIDER=better-auth  # Set to "better-auth" to enable
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:4000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Apple OAuth (optional)
APPLE_CLIENT_ID=your_apple_client_id
APPLE_CLIENT_SECRET=your_apple_client_secret
``````

**Important:** Never commit secrets to version control. Use different values for development, staging, and production.

## Step 4: Frontend Integration

### Install Better Auth Client

The Better Auth client is included in `@terreno/rtk`.

### Configure Redux Store

``````typescript
import {createBetterAuthClient, generateBetterAuthSlice} from "@terreno/rtk";
import {configureStore} from "@reduxjs/toolkit";

// Create Better Auth client
const authClient = createBetterAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL!,
  basePath: "/api/auth",
});

// Generate Redux slice
const {
  betterAuthReducer,
  actions,
  selectors,
  middleware,
} = generateBetterAuthSlice(authClient);

export const store = configureStore({
  reducer: {
    betterAuth: betterAuthReducer,
  },
  middleware: (getDefault) => getDefault().concat(...middleware),
});

export const {selectIsAuthenticated, selectUser, selectUserId} = selectors;
``````

### Social Login Buttons

Use `SocialLoginButton` from `@terreno/ui`:

``````typescript
import {SocialLoginButton} from "@terreno/ui";
import {authClient} from "@/store";

export const LoginScreen = () => {
  const handleGoogleLogin = async () => {
    await authClient.signIn.social({provider: "google"});
  };

  const handleGitHubLogin = async () => {
    await authClient.signIn.social({provider: "github"});
  };

  const handleAppleLogin = async () => {
    await authClient.signIn.social({provider: "apple"});
  };

  return (
    <Box padding={4} gap={3}>
      <SocialLoginButton provider="google" onPress={handleGoogleLogin} />
      <SocialLoginButton provider="github" onPress={handleGitHubLogin} />
      <SocialLoginButton provider="apple" onPress={handleAppleLogin} />
    </Box>
  );
};
``````

### Email/Password Authentication

``````typescript
import {authClient} from "@/store";

// Sign up
await authClient.signUp.email({
  email: "user@example.com",
  password: "secure-password",
  name: "User Name",
});

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "secure-password",
});

// Sign out
await authClient.signOut();
``````

## Authentication Flow

### Social OAuth Flow

1. User clicks social login button (Google/GitHub/Apple)
2. Frontend calls `authClient.signIn.social({provider})`
3. Better Auth redirects to OAuth provider
4. User authorizes on provider's page
5. Provider redirects back to Better Auth callback
6. Better Auth creates/finds user, creates session
7. Frontend redirected back to app with session
8. Frontend stores session automatically

### Email/Password Flow

1. User submits email and password
2. Frontend calls `authClient.signIn.email({email, password})`
3. Backend validates credentials
4. Backend creates session
5. Frontend stores session automatically

## Session Management

Better Auth sessions are automatically:
- Stored securely (expo-secure-store on mobile, AsyncStorage on web)
- Included in API requests via middleware
- Refreshed when needed
- Cleared on logout

Access current session in Redux:

``````typescript
import {selectIsAuthenticated, selectUser, selectUserId} from "@/store";
import {useSelector} from "react-redux";

export const ProfileScreen = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const userId = useSelector(selectUserId);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <Text>Welcome, {user?.name}!</Text>;
};
``````

## Creating OAuth Apps

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth client ID
5. Configure consent screen
6. Create OAuth client:
   - **Application type**: Web application
   - **Authorized redirect URIs**: `http://localhost:4000/api/auth/google/callback` (dev) and your production URL
7. Copy Client ID and Client Secret

### GitHub OAuth

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Your App Name
   - **Homepage URL**: `http://localhost:4000` (dev) or your production URL
   - **Authorization callback URL**: `http://localhost:4000/api/auth/github/callback`
4. Copy Client ID and generate/copy Client Secret

### Apple OAuth

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Register an App ID with "Sign in with Apple" capability
3. Create a Services ID
4. Configure "Sign in with Apple":
   - **Return URLs**: `http://localhost:4000/api/auth/apple/callback` (dev) and production URL
5. Create a private key for Sign in with Apple
6. Use Services ID as Client ID and private key as Client Secret

## JWT vs Better Auth

| Feature | JWT/Passport | Better Auth |
|---------|-------------|-------------|
| Social OAuth | GitHub only | Google, GitHub, Apple |
| Email/Password | ✅ | ✅ |
| Mobile deep links | Manual setup | Built-in |
| Session storage | Manual | Automatic |
| Modern APIs | Traditional | Modern |
| Use case | Existing apps | New apps or modernization |

**Can I use both?** Yes! Run JWT and Better Auth in parallel. Use `AUTH_PROVIDER=better-auth` to set the default, but both systems work independently.

## Troubleshooting

### "Better Auth not initialized"

- Verify `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are set
- Check that `enabled: true` in Better Auth config
- Ensure BetterAuthApp plugin is registered

### OAuth redirects fail

- Verify callback URLs in OAuth app settings match `{baseURL}{basePath}/{provider}/callback`
- Check `trustedOrigins` includes your mobile app scheme (e.g., `terreno://`, `exp://`)
- Ensure HTTPS in production (OAuth providers require it)

### User not synced to Mongoose

- Verify `betterAuthId` field exists on user schema
- Check backend logs for sync errors
- Ensure `userModel` is passed to BetterAuthApp

### Session not persisting

- Check that Redux middleware is properly configured
- Verify SecureStore/AsyncStorage permissions
- Ensure session is not being cleared on app restart

## Security Considerations

- **Keep secrets secure** — Never commit `BETTER_AUTH_SECRET` or OAuth secrets to version control
- **Use HTTPS in production** — OAuth providers require HTTPS for callbacks
- **Validate redirect origins** — `trustedOrigins` prevents open redirect vulnerabilities
- **Rotate secrets regularly** — Change secrets periodically and on suspected compromise
- **Scope minimization** — Only request OAuth scopes your app needs

## Learn More

- [Authentication architecture](../explanation/authentication.md)
- [Add GitHub OAuth (JWT)](./add-github-oauth.md)
- [API reference](../reference/api.md)
- [@terreno/rtk reference](../reference/rtk.md)
- [@terreno/ui reference](../reference/ui.md)
