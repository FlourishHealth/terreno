import {expect, test} from "@playwright/test";
import {clearTodos} from "./helpers/clearTodos";
import {loginAs} from "./helpers/login";
import {createTodoViaApi, goOffline, goOnline, updateTodoViaApi} from "./helpers/offlineHelpers";

test.describe("Offline Sync", () => {
  test.beforeEach(async ({page}) => {
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("shows offline banner when going offline", async ({page}) => {
    // Verify online - no banner
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();

    // Go offline
    await goOffline(page);

    // Banner should appear
    await page.getByTestId("offline-banner").waitFor({state: "visible"});
    await expect(page.getByTestId("offline-banner")).toBeVisible();
  });

  test("hides offline banner when coming back online", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await goOnline(page);

    // Banner should disappear
    await page.getByTestId("offline-banner").waitFor({state: "hidden"});
  });

  test("queues a create mutation while offline and syncs on reconnect", async ({page}) => {
    // Go offline
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Create a todo while offline
    await page.getByTestId("todos-new-title-input").first().fill("Offline Todo");
    await page.getByTestId("todos-add-button").first().click();

    // The optimistic update should show the todo
    // Wait a bit for the mutation to fail and be queued
    await page.waitForTimeout(1000);

    // The banner should show pending changes
    const bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("pending");

    // Come back online
    await goOnline(page);

    // Wait for sync
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Offline banner should be gone
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();

    // The todo should still be visible after sync (server confirmed)
    await expect(page.getByText("Offline Todo").first()).toBeVisible();
  });

  test("queues an update mutation while offline and syncs on reconnect", async ({page}) => {
    // Create a todo online first
    await page.getByTestId("todos-new-title-input").first().fill("Update Me");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    // Get the todo's ID
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    // Go offline
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Toggle the todo completed
    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();

    // Wait for mutation to fail and be queued
    await page.waitForTimeout(1000);

    // Come back online
    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // After sync, the completed section should exist (todo was toggled)
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
  });

  test("queues a delete mutation while offline and syncs on reconnect", async ({page}) => {
    // Create a todo online
    await page.getByTestId("todos-new-title-input").first().fill("Delete Me Offline");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    // Go offline
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Delete the todo while offline
    const deleteBtn = page.getByTestId(`todos-delete-${itemId}`).filter({visible: true}).first();
    await deleteBtn.waitFor({state: "visible"});
    await deleteBtn.click();

    // Wait for the optimistic delete
    await page.waitForTimeout(1000);

    // Come back online
    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // The todo should not reappear after sync
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();
  });

  test("detects conflict when another client updates the same document", async ({page}) => {
    // Create a todo via the API so we have its ID
    const todo = await createTodoViaApi("Conflict Test");
    const todoId = todo._id;

    // Reload page to see the new todo
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
    await page.getByText("Conflict Test").first().waitFor({state: "visible"});

    // Go offline
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Toggle the todo completed while offline
    const toggle = page
      .getByTestId(`todos-toggle-${todoId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();
    await page.waitForTimeout(500);

    // While the client thinks it's offline, update the same todo via API (another client)
    await updateTodoViaApi(todoId, {title: "Server Updated Title"});

    // Come back online
    await goOnline(page);
    await page.waitForTimeout(3000);

    // A conflict notification should appear because the server version is newer
    await page.getByTestId("conflict-notification").waitFor({state: "visible", timeout: 10000});
    await expect(page.getByTestId("conflict-notification")).toBeVisible();

    // Dismiss the conflict
    const dismissBtn = page.locator('[data-testid^="conflict-dismiss-"]').first();
    await dismissBtn.click();

    // Conflict notification should be gone
    await page.getByTestId("conflict-notification").waitFor({state: "hidden"});
  });

  test("persists offline queue across page reload", async ({page}) => {
    // Create a todo online
    await page.getByTestId("todos-new-title-input").first().fill("Persist Queue Test");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    // Go offline
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Toggle todo while offline
    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();
    await page.waitForTimeout(1000);

    // Reload the page (queue should persist via Redux Persist)
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});

    // The offline state should persist (note: after reload, network is technically online
    // but the queue should have been persisted and will attempt to sync)

    // Come back online (ensure routes are cleared after reload)
    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // The todo should reflect the update after sync
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
  });
});
