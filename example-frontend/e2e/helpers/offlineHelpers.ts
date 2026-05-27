import {type Page, request} from "@playwright/test";
import {TEST_USER} from "../fixtures/testUsers";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/**
 * Simulate going offline by blocking API requests and dispatching offline event.
 */
export const goOffline = async (page: Page): Promise<void> => {
  // Block all API requests to the backend
  await page.route(`${API_URL}/**`, (route) => route.abort("connectionrefused"));
  await page.route("**/todos**", (route) => {
    // Only block if it's going to our API
    const url = route.request().url();
    if (url.includes("localhost:4000") || url.includes(API_URL)) {
      return route.abort("connectionrefused");
    }
    return route.continue();
  });

  // Dispatch the offline event so the middleware detects the state change
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
  });
};

/**
 * Simulate coming back online by removing route blocks and dispatching online event.
 */
export const goOnline = async (page: Page): Promise<void> => {
  // Remove all route blocks
  await page.unroute(`${API_URL}/**`);
  await page.unroute("**/todos**");

  // Dispatch the online event
  await page.evaluate(() => {
    window.dispatchEvent(new Event("online"));
  });
};

/**
 * Get an auth token for direct API calls.
 */
const getApiToken = async (): Promise<string> => {
  const apiContext = await request.newContext({baseURL: API_URL});
  const loginRes = await apiContext.post("/auth/login", {
    data: {email: TEST_USER.email, password: TEST_USER.password},
  });
  if (!loginRes.ok()) {
    await apiContext.dispose();
    throw new Error(`getApiToken: login failed with status ${loginRes.status()}`);
  }
  const loginData = await loginRes.json();
  const token = (loginData.data?.token ?? loginData.token) as string;
  await apiContext.dispose();
  return token;
};

/**
 * Create a todo directly via the API (bypassing the browser).
 * Returns the created todo including its _id and updated timestamp.
 */
export const createTodoViaApi = async (
  title: string
): Promise<{_id: string; id: string; title: string; updated: string}> => {
  const token = await getApiToken();
  const apiContext = await request.newContext({baseURL: API_URL});
  const res = await apiContext.post("/todos", {
    data: {title},
    headers: {authorization: `Bearer ${token}`},
  });
  const data = await res.json();
  await apiContext.dispose();
  return data.data;
};

/**
 * Update a todo directly via the API (simulating another client).
 */
export const updateTodoViaApi = async (
  todoId: string,
  body: Record<string, unknown>
): Promise<{_id: string; title: string; updated: string}> => {
  const token = await getApiToken();
  const apiContext = await request.newContext({baseURL: API_URL});
  const res = await apiContext.patch(`/todos/${todoId}`, {
    data: body,
    headers: {authorization: `Bearer ${token}`},
  });
  const data = await res.json();
  await apiContext.dispose();
  return data.data;
};
