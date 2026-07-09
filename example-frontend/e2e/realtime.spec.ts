import {type APIRequestContext, request} from "@playwright/test";
import {expect, test} from "./fixtures/test";
import {REALTIME_USER, SECOND_USER} from "./fixtures/testUsers";
import {signUpOrSignInBetterAuth} from "./helpers/betterAuthSession";
import {loginAs} from "./helpers/login";
import {
  allowSyncDbNoise,
  CONVERGE_TIMEOUT,
  openSyncTodos,
  todoItemByTitle,
  waitForSyncTodosScreen,
} from "./helpers/syncdbSuite";
import {clearTodosAs, createTodoAs} from "./helpers/todosApi";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

interface BackendClient {
  api: APIRequestContext;
  token: string;
  userId?: string;
}

const getBackendClient = async (
  user: {email: string; name?: string; password: string} = REALTIME_USER
): Promise<BackendClient> => {
  const api = await request.newContext({baseURL: API_URL});
  const token = await signUpOrSignInBetterAuth(api, {
    email: user.email,
    name: user.name ?? user.email,
    password: user.password,
  });
  const meRes = await api.get("/auth/me", {headers: {authorization: `Bearer ${token}`}});
  const meData = meRes.ok() ? await meRes.json() : null;
  const userId = (meData?.data?._id ?? meData?._id) as string | undefined;
  return {api, token, userId};
};

test.describe("Realtime sync", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(REALTIME_USER);
    await loginAs(page, REALTIME_USER);
    await openSyncTodos(page);
  });

  test("UI receives realtime create events from another client", async ({page}) => {
    await expect(page.getByTestId("todos-empty-state")).toBeVisible();

    const {api, token} = await getBackendClient();
    try {
      const createRes = await api.post("/todos", {
        data: {title: "Created via API"},
        headers: {authorization: `Bearer ${token}`},
      });
      expect(createRes.ok()).toBe(true);

      await expect(page.getByText("Created via API").first()).toBeVisible({
        timeout: CONVERGE_TIMEOUT,
      });
      await expect(page.getByTestId("todos-empty-state")).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });

  test("UI receives realtime update events from another client", async ({page}) => {
    const seeded = await createTodoAs(REALTIME_USER, "Update me");
    await page.reload();
    await waitForSyncTodosScreen(page);
    await todoItemByTitle(page, "Update me").waitFor({state: "visible"});

    const {api, token} = await getBackendClient();
    try {
      const patchRes = await api.patch(`/todos/${seeded._id}`, {
        data: {completed: true, title: "Update me"},
        headers: {authorization: `Bearer ${token}`},
      });
      expect(patchRes.ok()).toBe(true);

      await page.getByTestId("todos-completed-section").waitFor({
        state: "visible",
        timeout: CONVERGE_TIMEOUT,
      });
      await expect(page.getByText("Update me").first()).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test("UI receives realtime delete events from another client", async ({page}) => {
    const seeded = await createTodoAs(REALTIME_USER, "Delete me from API");
    await page.reload();
    await waitForSyncTodosScreen(page);
    const todoItem = todoItemByTitle(page, "Delete me from API");
    await todoItem.waitFor({state: "visible"});
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "";

    const {api, token} = await getBackendClient();
    try {
      const deleteRes = await api.delete(`/todos/${seeded._id}`, {
        headers: {authorization: `Bearer ${token}`},
      });
      expect(deleteRes.ok()).toBe(true);

      await page.getByTestId(todoTestId).waitFor({state: "hidden", timeout: CONVERGE_TIMEOUT});
      await page.getByTestId("todos-empty-state").waitFor({state: "visible"});
    } finally {
      await api.dispose();
    }
  });
});

test.describe("Realtime cross-user isolation", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(REALTIME_USER);
    await clearTodosAs(SECOND_USER);
  });

  test("user A does not see realtime events for user B's todos", async ({page}) => {
    await loginAs(page, REALTIME_USER);
    await openSyncTodos(page);
    await expect(page.getByTestId("todos-empty-state")).toBeVisible();

    const {api, token} = await getBackendClient(SECOND_USER);
    try {
      const createRes = await api.post("/todos", {
        data: {title: "User B's secret todo"},
        headers: {authorization: `Bearer ${token}`},
      });
      expect(createRes.ok()).toBe(true);

      await page.waitForTimeout(2_000);

      await expect(page.getByText("User B's secret todo")).toHaveCount(0);
      await expect(page.getByTestId("todos-empty-state")).toBeVisible();
    } finally {
      await api.dispose();
    }
  });
});

test.describe("Realtime reconnection", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(REALTIME_USER);
    await loginAs(page, REALTIME_USER);
    await openSyncTodos(page);
  });

  test("UI catches up after a WebSocket disconnect", async ({page}) => {
    await expect(page.getByTestId("todos-empty-state")).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });

    const {api, token} = await getBackendClient();
    try {
      const createRes = await api.post("/todos", {
        data: {title: "Post-reconnect todo"},
        headers: {authorization: `Bearer ${token}`},
      });
      expect(createRes.ok()).toBe(true);
      await expect(page.getByText("Post-reconnect todo").first()).toBeVisible({timeout: 15_000});
    } finally {
      await api.dispose();
    }
  });
});
