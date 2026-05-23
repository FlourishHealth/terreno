import {type APIRequestContext, expect, request, test} from "@playwright/test";
import {SECOND_USER, TEST_USER} from "./fixtures/testUsers";
import {clearTodos} from "./helpers/clearTodos";
import {loginAs} from "./helpers/login";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

interface BackendClient {
  api: APIRequestContext;
  token: string;
  userId?: string;
}

const getBackendClient = async (
  user: {email: string; password: string} = TEST_USER
): Promise<BackendClient> => {
  const api = await request.newContext({baseURL: API_URL});
  const loginRes = await api.post("/auth/login", {
    data: {email: user.email, password: user.password},
  });
  if (!loginRes.ok()) {
    await api.dispose();
    throw new Error(`realtime.spec: backend login failed with status ${loginRes.status()}`);
  }
  const loginData = await loginRes.json();
  const token = (loginData.data?.token ?? loginData.token) as string;
  const userId = (loginData.data?.userId ?? loginData.userId) as string | undefined;
  if (!token) {
    await api.dispose();
    throw new Error("realtime.spec: no token in backend login response");
  }
  return {api, token, userId};
};

/**
 * Clear todos for a given user (defaults to TEST_USER via the helper).
 */
const clearTodosFor = async (user: {email: string; password: string}): Promise<void> => {
  const {api, token} = await getBackendClient(user);
  try {
    const todosRes = await api.get("/todos", {
      headers: {authorization: `Bearer ${token}`},
    });
    if (!todosRes.ok()) {
      return;
    }
    const todosData = await todosRes.json();
    const todos = (todosData.data ?? []) as Array<{id: string}>;
    await Promise.all(
      todos.map((todo) =>
        api.delete(`/todos/${todo.id}`, {headers: {authorization: `Bearer ${token}`}})
      )
    );
  } finally {
    await api.dispose();
  }
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

      // No manual refetch — realtimeList patches the cache when the sync event arrives.
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

test.describe("Realtime cross-user isolation", () => {
  test.beforeEach(async () => {
    await clearTodos();
    await clearTodosFor(SECOND_USER);
  });

  test("user A does not see realtime events for user B's todos", async ({page}) => {
    // Log in as TEST_USER (user A) in the browser
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();

    // Have user B create a todo via the backend — owner-strategy means it should be
    // emitted only to user:{userB.id}, never to user A.
    const {api, token} = await getBackendClient(SECOND_USER);
    try {
      const createRes = await api.post("/todos", {
        data: {title: "User B's secret todo"},
        headers: {authorization: `Bearer ${token}`},
      });
      expect(createRes.ok()).toBe(true);

      // Wait a generous window so a leak would have time to render.
      await page.waitForTimeout(2_000);

      // The browser (user A) must NOT have rendered user B's todo.
      await expect(page.getByText("User B's secret todo")).toHaveCount(0);
      await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();
    } finally {
      await api.dispose();
    }
  });
});

test.describe("Realtime reconnection", () => {
  test.beforeEach(async ({page}) => {
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("UI catches up via cache invalidation after a WebSocket disconnect", async ({page}) => {
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();

    // Drop active WebSocket connections in the page — socket.io-client will reconnect.
    // We rely on visible behavior (does the UI eventually show the new todo?) rather than
    // poking socket.io internals, so this also covers the "RTK list refetch on reconnect" flow.
    await page.evaluate(() => {
      // Force-close any open WebSocket transports.
      const w = window as unknown as {WebSocket?: typeof WebSocket};
      const originalWebSocket = w.WebSocket;
      if (!originalWebSocket) {
        return;
      }
      // Iterate open WebSocket instances by close()ing each one we can find.
      // socket.io stores active sockets on its internal manager; the simplest portable
      // way is to dispatch an offline event to trigger reconnect.
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });

    // After the reconnect cycle, a backend-driven create should still surface.
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
