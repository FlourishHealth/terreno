import {type APIRequestContext, test as setup} from "@playwright/test";
import {ADMIN_USER, ALL_E2E_USERS} from "./fixtures/testUsers";
import {setUserAdmin} from "./helpers/adminAuth";
import {setSyncDbFlag} from "./helpers/syncdbFlag";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

setup("create test users", async ({request}) => {
  for (const user of ALL_E2E_USERS) {
    await createUser(request, user);
    if (user.email === ADMIN_USER.email) {
      await setUserAdmin(ADMIN_USER.email);
    }
    await acceptPendingConsentForms(request, user);
  }

  // Ensure the use-syncdb flag exists and starts disabled. Creating it here (in the
  // setup project, before any spec runs) means the per-file setSyncDbFlag guards only
  // ever PATCH an existing flag — concurrent guards in parallel workers cannot race
  // on flag creation.
  await setSyncDbFlag(false);
});

const createUser = async (
  request: APIRequestContext,
  user: {email: string; name: string; password: string}
): Promise<void> => {
  const response = await request.post(`${API_URL}/auth/signup`, {
    data: {
      email: user.email,
      name: user.name,
      password: user.password,
    },
  });

  const status = response.status();
  if (status >= 200 && status < 300) {
    return;
  }
  const body = await response.text();
  // Backend returns 500 for duplicate user — acceptable on reruns
  if (body.includes("already registered")) {
    return;
  }
  throw new Error(`Failed to create user ${user.email}: ${status} ${body}`);
};

const acceptPendingConsentForms = async (
  request: APIRequestContext,
  user: {email: string; password: string}
): Promise<void> => {
  // Login to get a token
  const loginRes = await request.post(`${API_URL}/auth/login`, {
    data: {email: user.email, password: user.password},
  });
  if (!loginRes.ok()) {
    return;
  }
  const loginData = await loginRes.json();
  const token: string = loginData?.data?.token ?? loginData?.token ?? "";
  if (!token) {
    return;
  }

  // Fetch pending consent forms
  const pendingRes = await request.get(`${API_URL}/consents/pending`, {
    headers: {authorization: `Bearer ${token}`},
  });
  if (!pendingRes.ok()) {
    return;
  }
  const pendingData = await pendingRes.json();
  const forms: Array<{_id: string; captureSignature?: boolean}> = pendingData?.data ?? [];

  // Submit a response for each pending form
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
