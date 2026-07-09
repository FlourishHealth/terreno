import {type APIRequestContext, test as setup} from "@playwright/test";
import {ADMIN_USER, ALL_E2E_USERS} from "./fixtures/testUsers";
import {setUserAdmin} from "./helpers/adminAuth";
import {signUpOrSignInBetterAuth} from "./helpers/betterAuthSession";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

setup("create test users", async ({request}) => {
  for (const user of ALL_E2E_USERS) {
    await createUser(request, user);
    if (user.email === ADMIN_USER.email) {
      await setUserAdmin(ADMIN_USER.email);
    }
    await acceptPendingConsentForms(request, user);
  }
});

const createUser = async (
  request: APIRequestContext,
  user: {email: string; name: string; password: string}
): Promise<void> => {
  try {
    await signUpOrSignInBetterAuth(request, user);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already")) {
      return;
    }
    throw error;
  }
};

const acceptPendingConsentForms = async (
  request: APIRequestContext,
  user: {email: string; name: string; password: string}
): Promise<void> => {
  const token = await signUpOrSignInBetterAuth(request, user);

  const pendingRes = await request.get(`${API_URL}/consents/pending`, {
    headers: {authorization: `Bearer ${token}`},
  });
  if (!pendingRes.ok()) {
    return;
  }
  const pendingData = await pendingRes.json();
  const forms: Array<{_id: string; captureSignature?: boolean}> = pendingData?.data ?? [];

  for (const form of forms) {
    await request.post(`${API_URL}/consents/respond`, {
      data: {
        agreed: true,
        consentFormId: form._id,
        locale: "en",
        ...(form.captureSignature ? {signature: "Test User"} : {}),
      },
      headers: {authorization: `Bearer ${token}`},
    });
  }
};
