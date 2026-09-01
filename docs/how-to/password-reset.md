# Password reset and email verification

Wire JWT recovery routes and Better Auth to `@terreno/comms` mail, then add a reset screen.

## 1. User schema

1. Apply `emailVerificationPlugin` so `emailVerified` defaults to false.
2. Add `tokenEpoch` (number, default 0) so password reset can invalidate refresh tokens.

```typescript
import {emailVerificationPlugin} from "@terreno/api";

userSchema.plugin(emailVerificationPlugin);
```

## 2. JWT `authOptions`

Set `publicAppUrl` and `sendMail`. Forgot-password always returns 202.

```typescript
authOptions: {
  publicAppUrl: process.env.FRONTEND_URL || "http://localhost:8082",
  sendMail: async (message) => {
    await getCommsService().sendMail(message);
  },
  requireEmailVerification: false,
}
```

| Action | Path | Body |
| --- | --- | --- |
| Forgot | `POST /auth/forgotPassword` | `{email}` → 202 |
| Reset | `POST /auth/resetPassword` or `POST /resetPassword` | `{token, password}` or `{token, newPassword}` |
| Send verify | `POST /auth/sendVerification` | authenticated → 202 |
| Verify | `POST /auth/verifyEmail` | `{token}` |

Reset links: `${publicAppUrl}/resetPassword?token=...`. Verify links: `${publicAppUrl}/verifyEmail?token=...`.

Set `requireEmailVerification: true` to return 403 `email-not-verified` on JWT login until verify succeeds. Signup still returns JWTs and sends the verify mail.

## 3. Comms templates

```typescript
import {renderAuthMail} from "@terreno/comms";

const mail = renderAuthMail({
  publicAppUrl: "https://app.example.com",
  templateId: "resetPassword",
  token,
});
```

Pass `templates` to override subject/text/html. Variables: `resetUrl`, `verifyUrl`, `publicAppUrl`, `token`.

## 4. Better Auth

On `BetterAuthConfig` set the same `publicAppUrl`, `sendMail`, and `renderAuthMail` from `@terreno/comms`. That wires `sendResetPassword` and `sendVerificationEmail` to those templates.

## 5. Frontend

1. Pass `onForgotPassword` (or `onForgotPasswordPress`) to `LoginScreen`.
2. Add `/forgotPassword` (email form) and `/resetPassword` that reads `token` from the query string.
3. On Better Auth apps, request reset with `authClient.requestPasswordReset` and submit with `authClient.resetPassword({newPassword, token})`. JWT apps use `POST /auth/forgotPassword` and the RTK `resetPassword` mutation (`POST /resetPassword`). The example app tries Better Auth first, then the RTK mutation so either token type can complete.
4. Show a profile banner when `emailVerified` is false, with Resend calling `POST /auth/sendVerification`.
5. Add `/verifyEmail` that reads `token` from the query string. JWT apps call `POST /auth/verifyEmail`. Better Auth apps try `authClient` `/verify-email` first, then the JWT route so either token type can complete.

A new `issueFor` for the same user and type invalidates earlier unused tokens of that type. `emailVerified` and `tokenEpoch` are privileged user fields: signup and `PATCH /auth/me` drop them.

Console mail in development prints length only; check `CommsMessage` / console adapter logs for delivery, not the raw token in logger output. Request logs redact `password`, `newPassword`, `oldPassword`, `token`, and `refreshToken`.
