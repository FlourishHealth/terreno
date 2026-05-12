import {type APIRequestContext, expect, request, test} from "@playwright/test";
import {TEST_USER} from "./fixtures/testUsers";
import {clearTodos} from "./helpers/clearTodos";
import {loginAs} from "./helpers/login";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

interface BackendClient {
  api: APIRequestContext;
  token: string;
}

const getBackendClient = async (): Promise<BackendClient> => {
  const api = await request.newContext({baseURL: API_URL});
  const loginRes = await api.post("/auth/login", {
    data: {email: TEST_USER.email, password: TEST_USER.password},
  });
  if (!loginRes.ok()) {
    await api.dispose();
    throw new Error(`realtime.spec: backend login failed with status ${loginRes.status()}`);
  }
  const loginData = await loginRes.json();
  const token = (loginData.data?.token ?? loginData.token) as string;
  if (!token) {
    await api.dispose();
    throw new Error("realtime.spec: no token in backend login response");
  }
  return {api, token};
};

test.describe("Realtime sync", () => {
  test.beforeEach(async ({page}) => {
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("UI receives realtime create events from another client", async ({page}) => {
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();

    const {api, token} = await getBackendClient();
    try {
      const createRes = await api.post("/todos", {
        data: {title: "Created via API"},
        headers: {authorization: `Bearer ${token}`},
      });
      expect(createRes.ok()).toBe(true);

      // No manual refetch — the WebSocket sync must invalidate the list cache
      // and trigger a re-render with the new todo.
      await expect(page.getByText("Created via API").first()).toBeVisible({timeout: 10_000});
      await expect(page.getByTestId("todos-empty-text").first()).not.toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test("UI receives realtime update events from another client", async ({page}) => {
    // Seed a todo via UI so the list query is cached on the frontend
    await page.getByTestId("todos-new-title-input").first().fill("Update me");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "";
    const itemId = todoTestId.replace("todos-item-", "");
    expect(itemId).toBeTruthy();

    const {api, token} = await getBackendClient();
    try {
      const patchRes = await api.patch(`/todos/${itemId}`, {
        data: {completed: true, title: "Update me"},
        headers: {authorization: `Bearer ${token}`},
      });
      expect(patchRes.ok()).toBe(true);

      // The completed section should appear without manual refresh — proving
      // useSyncConnection patched the cached todo to completed.
      await page
        .getByTestId("todos-completed-section-toggle-clickable")
        .waitFor({state: "visible", timeout: 10_000});
      await expect(page.getByText("Update me").first()).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test("UI receives realtime delete events from another client", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Delete me from API");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "";
    const itemId = todoTestId.replace("todos-item-", "");
    expect(itemId).toBeTruthy();

    const {api, token} = await getBackendClient();
    try {
      const deleteRes = await api.delete(`/todos/${itemId}`, {
        headers: {authorization: `Bearer ${token}`},
      });
      expect(deleteRes.ok()).toBe(true);

      // Without manual refresh, the todo card should disappear from the UI.
      await page.getByTestId(todoTestId).waitFor({state: "hidden", timeout: 10_000});
      await page.getByTestId("todos-empty-text").first().waitFor({state: "visible"});
    } finally {
      await api.dispose();
    }
  });
});
