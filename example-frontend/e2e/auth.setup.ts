import {test as setup} from "@playwright/test";
import {TEST_USER} from "./fixtures/testUsers";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

setup("create test user", async ({request}) => {
  const response = await request.post(`${API_URL}/auth/signup`, {
    data: {
      email: TEST_USER.email,
      name: TEST_USER.name,
      password: TEST_USER.password,
    },
  });

  const status = response.status();
  if (status >= 200 && status < 300) {
    await acceptPendingConsentForms(request);
    return;
  }
  const body = await response.text();
  // Backend returns 500 for duplicate user — acceptable on reruns
  if (body.includes("already registered")) {
    await acceptPendingConsentForms(request);
    return;
  }
  throw new Error(`Failed to create test user: ${status} ${body}`);
});

const acceptPendingConsentForms = async (
  request: Parameters<Parameters<typeof setup>[1]>[0]["request"]
): Promise<void> => {
  // Login to get a token
  const loginRes = await request.post(`${API_URL}/auth/login`, {
    data: {email: TEST_USER.email, password: TEST_USER.password},
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
