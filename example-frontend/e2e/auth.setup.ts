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
    return; // Created successfully
  }
  const body = await response.text();
  // Backend returns 500 for duplicate user — acceptable on reruns
  if (body.includes("already registered")) {
    return;
  }
  throw new Error(`Failed to create test user: ${status} ${body}`);
});
