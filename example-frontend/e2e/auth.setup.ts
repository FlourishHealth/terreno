import {test as setup} from "@playwright/test";
import {ADMIN_USER, TEST_USER} from "./fixtures/testUsers";
import {setUserAdmin} from "./helpers/adminAuth";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

setup("create test user", async ({request}) => {
  // Create the regular test user
  await createUser(request, TEST_USER);
  await acceptPendingConsentForms(request, TEST_USER);

  // Create the admin user and promote
  await createUser(request, ADMIN_USER);
  await setUserAdmin(ADMIN_USER.email);
  await acceptPendingConsentForms(request, ADMIN_USER);
});

const createUser = async (
  request: Parameters<Parameters<typeof setup>[1]>[0]["request"],
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
  request: Parameters<Parameters<typeof setup>[1]>[0]["request"],
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
