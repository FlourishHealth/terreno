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

  // 201 = created successfully; 409 = user already exists (acceptable on reruns)
  const status = response.status();
  if (status !== 201 && status !== 409) {
    throw new Error(`Failed to create test user: ${status} ${await response.text()}`);
  }
});
