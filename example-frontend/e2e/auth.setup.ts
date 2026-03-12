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

  // 201 = created successfully; 4xx = already exists or validation error (acceptable on reruns)
  if (response.status() >= 500) {
    throw new Error(`Failed to create test user: ${response.status()} ${await response.text()}`);
  }
});
