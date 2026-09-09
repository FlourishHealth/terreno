export interface BetterAuthActionResult {
  error?: {message?: string} | null;
}

export const submitPasswordResetRequest = async ({
  email,
  requestJwtPasswordReset,
  requestPasswordReset,
}: {
  email: string;
  requestJwtPasswordReset: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<BetterAuthActionResult>;
}): Promise<{errorMessage?: string; submitted: boolean}> => {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return {errorMessage: "Enter the email for your account.", submitted: false};
  }
  try {
    const result = await requestPasswordReset(trimmedEmail);
    if (result.error) {
      await requestJwtPasswordReset(trimmedEmail);
    }
    return {submitted: true};
  } catch (error: unknown) {
    console.error("[forgotPassword] Request failed", error);
    return {errorMessage: "Could not send a reset email. Please try again.", submitted: false};
  }
};

export const submitPasswordReset = async ({
  password,
  resetJwtPassword,
  resetPasswordWithToken,
  token,
}: {
  password: string;
  resetJwtPassword: (args: {password: string; token: string}) => Promise<void>;
  resetPasswordWithToken: (args: {
    newPassword: string;
    token: string;
  }) => Promise<BetterAuthActionResult>;
  token: string | undefined;
}): Promise<{errorMessage?: string; submitted: boolean}> => {
  if (!token) {
    return {
      errorMessage: "This reset link is missing a token. Request a new email from the login page.",
      submitted: false,
    };
  }
  if (password.length < 6) {
    return {errorMessage: "Password must be at least 6 characters.", submitted: false};
  }
  try {
    const betterAuthResult = await resetPasswordWithToken({newPassword: password, token});
    if (betterAuthResult.error) {
      await resetJwtPassword({password, token});
    }
    return {submitted: true};
  } catch (error: unknown) {
    console.error("[resetPassword] Reset failed", error);
    return {
      errorMessage: "This reset link is invalid or expired. Request a new one from the login page.",
      submitted: false,
    };
  }
};

export const submitEmailVerification = async ({
  token,
  verifyEmailWithToken,
  verifyJwtEmail,
}: {
  token: string | undefined;
  verifyEmailWithToken: (args: {token: string}) => Promise<BetterAuthActionResult>;
  verifyJwtEmail: (token: string) => Promise<void>;
}): Promise<{errorMessage?: string; submitted: boolean}> => {
  if (!token) {
    return {
      errorMessage:
        "This verification link is missing a token. Request a new email from your profile.",
      submitted: false,
    };
  }
  try {
    const betterAuthResult = await verifyEmailWithToken({token});
    if (betterAuthResult.error) {
      await verifyJwtEmail(token);
    }
    return {submitted: true};
  } catch (error: unknown) {
    console.error("[verifyEmail] Verify failed", error);
    return {
      errorMessage:
        "This verification link is invalid or expired. Request a new one from your profile.",
      submitted: false,
    };
  }
};
