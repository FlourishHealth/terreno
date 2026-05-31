import {expect, test} from "./fixtures/test";
import {clearTodos} from "./helpers/clearTodos";
import {loginAs} from "./helpers/login";
import {
  allowOfflineNoise,
  createTodoViaApi,
  goOffline,
  goOnline,
  updateTodoViaApi,
} from "./helpers/offlineHelpers";

test.describe("Offline Sync", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowOfflineNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("shows offline banner when going offline", async ({page}) => {
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();

    await goOffline(page);

    await page.getByTestId("offline-banner").waitFor({state: "visible"});
    await expect(page.getByTestId("offline-banner")).toBeVisible();
  });

  test("hides offline banner when coming back online", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await goOnline(page);

    await page.getByTestId("offline-banner").waitFor({state: "hidden"});
  });

  test("queues a create mutation while offline and syncs on reconnect", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await page.getByTestId("todos-new-title-input").first().fill("Offline Todo");
    await page.getByTestId("todos-add-button").first().click();

    await page.waitForTimeout(1000);

    const bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("pending");

    await goOnline(page);

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    await expect(page.getByText("Offline Todo").first()).toBeVisible();
  });

  test("queues an update mutation while offline and syncs on reconnect", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Update Me");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();

    await page.waitForTimeout(1000);

    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
  });

  test("queues a delete mutation while offline and syncs on reconnect", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Delete Me Offline");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const deleteBtn = page.getByTestId(`todos-delete-${itemId}`).filter({visible: true}).first();
    await deleteBtn.waitFor({state: "visible"});
    await deleteBtn.click();

    await page.waitForTimeout(1000);

    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();
  });

  test("detects conflict when another client updates the same document", async ({page}) => {
    const todo = await createTodoViaApi("Conflict Test");
    const todoId = todo._id;

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
    await page.getByText("Conflict Test").first().waitFor({state: "visible"});

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const toggle = page
      .getByTestId(`todos-toggle-${todoId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();
    await page.waitForTimeout(500);

    await updateTodoViaApi(todoId, {title: "Server Updated Title"});

    await goOnline(page);
    await page.waitForTimeout(3000);

    await page.getByTestId("conflict-notification").waitFor({state: "visible", timeout: 10000});
    await expect(page.getByTestId("conflict-notification")).toBeVisible();

    const useServerBtn = page.locator('[data-testid^="conflict-use-server-"]').first();
    await useServerBtn.click();

    await page.getByTestId("conflict-notification").waitFor({state: "hidden"});
  });

  test("persists offline queue across page reload", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Persist Queue Test");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();
    await page.waitForTimeout(1000);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});

    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
  });
});

test.describe("Offline Sync — Multiple Mutations", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowOfflineNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("queues multiple creates offline and syncs all on reconnect", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    for (const title of ["First Offline", "Second Offline", "Third Offline"]) {
      await page.getByTestId("todos-new-title-input").first().fill(title);
      await page.getByTestId("todos-add-button").first().click();
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(1000);

    const bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("3");
    expect(bannerText).toContain("pending");

    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    await expect(page.getByText("First Offline").first()).toBeVisible();
    await expect(page.getByText("Second Offline").first()).toBeVisible();
    await expect(page.getByText("Third Offline").first()).toBeVisible();
  });

  test("handles mixed create and update operations offline", async ({page}) => {
    // Create a todo online first
    await page.getByTestId("todos-new-title-input").first().fill("Online Todo");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Create a new todo while offline
    await page.getByTestId("todos-new-title-input").first().fill("New While Offline");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(500);

    // Toggle the existing todo completed
    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();
    await page.waitForTimeout(1000);

    const bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("pending");

    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    await expect(page.getByText("New While Offline").first()).toBeVisible();
    // The existing todo should now be in the completed section
    await page.getByTestId("todos-completed-section-toggle-clickable").waitFor({state: "visible"});
  });

  test("handles create followed by delete of same item offline", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Create a todo offline
    await page.getByTestId("todos-new-title-input").first().fill("Create Then Delete");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(1000);

    // The optimistic item should appear
    await expect(page.getByText("Create Then Delete").first()).toBeVisible();

    // Now delete it while still offline
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");
    const deleteBtn = page.getByTestId(`todos-delete-${itemId}`).filter({visible: true}).first();
    await deleteBtn.waitFor({state: "visible"});
    await deleteBtn.click();
    await page.waitForTimeout(1000);

    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    // After sync, the net result should be no todos (created then deleted)
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();
  });
});

test.describe("Offline Sync — Syncing Indicator", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowOfflineNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("shows syncing banner during replay", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Queue multiple mutations for a longer sync window
    for (const title of ["Sync A", "Sync B", "Sync C"]) {
      await page.getByTestId("todos-new-title-input").first().fill(title);
      await page.getByTestId("todos-add-button").first().click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1000);

    await goOnline(page);

    // The syncing banner should appear briefly while replaying
    await page.getByTestId("syncing-banner").waitFor({state: "visible", timeout: 5000});

    // Eventually syncing completes and both banners disappear
    await page.getByTestId("syncing-banner").waitFor({state: "hidden", timeout: 15000});
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
  });
});

test.describe("Offline Sync — Network Flapping", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowOfflineNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("recovers cleanly from rapid offline/online toggling", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Create a todo while offline
    await page.getByTestId("todos-new-title-input").first().fill("Flap Test");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(500);

    // Rapidly toggle connectivity
    await goOnline(page);
    await page.waitForTimeout(200);
    await goOffline(page);
    await page.waitForTimeout(200);
    await goOnline(page);
    await page.waitForTimeout(200);
    await goOffline(page);
    await page.waitForTimeout(500);

    // Finally stabilize online
    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);

    // Should recover and sync successfully without duplicates
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    const flapItems = page.getByText("Flap Test");
    const count = await flapItems.count();
    expect(count).toBe(1);
  });

  test("does not lose queued mutations during connectivity flapping", async ({page}) => {
    // Create two todos online to set up
    for (const title of ["Flap A", "Flap B"]) {
      await page.getByTestId("todos-new-title-input").first().fill(title);
      await page.getByTestId("todos-add-button").first().click();
      await page
        .locator('[data-testid^="todos-item-"]')
        .filter({visible: true})
        .first()
        .waitFor({state: "visible"});
      await page.waitForLoadState("networkidle");
    }

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Delete the first todo while offline
    const firstItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    const firstTestId = (await firstItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const firstId = firstTestId.replace("todos-item-", "");
    const firstDeleteBtn = page
      .getByTestId(`todos-delete-${firstId}`)
      .filter({visible: true})
      .first();
    await firstDeleteBtn.click();
    await page.waitForTimeout(500);

    // Brief online flap (not long enough to fully sync)
    await goOnline(page);
    await page.waitForTimeout(100);
    await goOffline(page);
    await page.waitForTimeout(500);

    // Stabilize online
    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);

    // The delete should have eventually synced
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    // Only the second todo should remain
    const items = page.locator('[data-testid^="todos-item-"]').filter({visible: true});
    await expect(items).toHaveCount(1);
  });
});

test.describe("Offline Sync — Queue Count & Banner Accuracy", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowOfflineNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("banner reflects correct pending count as mutations are queued", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Queue first mutation
    await page.getByTestId("todos-new-title-input").first().fill("Count 1");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(1000);

    let bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("1");
    expect(bannerText).toContain("pending");

    // Queue second mutation
    await page.getByTestId("todos-new-title-input").first().fill("Count 2");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(1000);

    bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("2");
    expect(bannerText).toContain("pending");

    // Queue third mutation
    await page.getByTestId("todos-new-title-input").first().fill("Count 3");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(1000);

    bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("3");
    expect(bannerText).toContain("pending");
  });

  test("banner shows singular form for 1 pending change", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await page.getByTestId("todos-new-title-input").first().fill("Singular");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(1000);

    const bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("1 pending change ");
    expect(bannerText).not.toContain("changes");
  });

  test("banner shows plural form for multiple pending changes", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await page.getByTestId("todos-new-title-input").first().fill("Plural A");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(500);
    await page.getByTestId("todos-new-title-input").first().fill("Plural B");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(1000);

    const bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("changes");
  });
});

test.describe("Offline Sync — Multiple Conflicts", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowOfflineNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("shows multiple conflict notifications for different documents", async ({page}) => {
    // Create two todos via the API
    const todoA = await createTodoViaApi("Conflict A");
    const todoB = await createTodoViaApi("Conflict B");

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
    await page.getByText("Conflict A").first().waitFor({state: "visible"});
    await page.getByText("Conflict B").first().waitFor({state: "visible"});

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Toggle both todos while offline
    const toggleA = page
      .getByTestId(`todos-toggle-${todoA._id}-clickable`)
      .filter({visible: true})
      .first();
    await toggleA.waitFor({state: "visible"});
    await toggleA.click();
    await page.waitForTimeout(500);

    const toggleB = page
      .getByTestId(`todos-toggle-${todoB._id}-clickable`)
      .filter({visible: true})
      .first();
    await toggleB.waitFor({state: "visible"});
    await toggleB.click();
    await page.waitForTimeout(500);

    // Update both via API (simulate another client)
    await updateTodoViaApi(todoA._id, {title: "Server A"});
    await updateTodoViaApi(todoB._id, {title: "Server B"});

    await goOnline(page);
    await page.waitForTimeout(5000);

    // Multiple conflict notifications should appear
    const conflicts = page.locator('[data-testid="conflict-notification"]');
    await conflicts.first().waitFor({state: "visible", timeout: 10000});
    const conflictCount = await conflicts.count();
    expect(conflictCount).toBe(2);
  });

  test("dismissing one conflict does not affect others", async ({page}) => {
    const todoA = await createTodoViaApi("Dismiss A");
    const todoB = await createTodoViaApi("Dismiss B");

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
    await page.getByText("Dismiss A").first().waitFor({state: "visible"});
    await page.getByText("Dismiss B").first().waitFor({state: "visible"});

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const toggleA = page
      .getByTestId(`todos-toggle-${todoA._id}-clickable`)
      .filter({visible: true})
      .first();
    await toggleA.waitFor({state: "visible"});
    await toggleA.click();
    await page.waitForTimeout(500);

    const toggleB = page
      .getByTestId(`todos-toggle-${todoB._id}-clickable`)
      .filter({visible: true})
      .first();
    await toggleB.waitFor({state: "visible"});
    await toggleB.click();
    await page.waitForTimeout(500);

    await updateTodoViaApi(todoA._id, {title: "Server Dismiss A"});
    await updateTodoViaApi(todoB._id, {title: "Server Dismiss B"});

    await goOnline(page);
    await page.waitForTimeout(5000);

    const conflicts = page.locator('[data-testid="conflict-notification"]');
    await conflicts.first().waitFor({state: "visible", timeout: 10000});
    expect(await conflicts.count()).toBe(2);

    // Dismiss only the first conflict by accepting the server version
    const firstUseServer = page.locator('[data-testid^="conflict-use-server-"]').first();
    await firstUseServer.click();
    await page.waitForTimeout(500);

    // One conflict should remain
    expect(await conflicts.count()).toBe(1);
  });
});

test.describe("Offline Sync — Optimistic UI", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowOfflineNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("optimistically shows created todo immediately while offline", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await page.getByTestId("todos-new-title-input").first().fill("Optimistic Create");
    await page.getByTestId("todos-add-button").first().click();

    // The todo should appear immediately via optimistic update, without waiting for network
    await expect(page.getByText("Optimistic Create").first()).toBeVisible({timeout: 2000});
    // Input should clear (mutation was accepted locally)
    await expect(page.getByTestId("todos-new-title-input").first()).toHaveValue("");
  });

  test("optimistically removes deleted todo immediately while offline", async ({page}) => {
    // Create a todo online first
    await page.getByTestId("todos-new-title-input").first().fill("Optimistic Delete");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const deleteBtn = page.getByTestId(`todos-delete-${itemId}`).filter({visible: true}).first();
    await deleteBtn.click();

    // The item should disappear immediately via optimistic update
    await page.getByTestId(todoTestId).waitFor({state: "hidden", timeout: 2000});
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();
  });

  test("optimistically toggles completion state while offline", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Optimistic Toggle");
    await page.getByTestId("todos-add-button").first().click();
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.click();

    // The completed section should appear immediately
    await page.getByTestId("todos-completed-section-toggle-clickable").waitFor({
      state: "visible",
      timeout: 2000,
    });
  });
});

test.describe("Offline Sync — Edge Cases", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowOfflineNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("does not show banner when online and no pending changes", async ({page}) => {
    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
    await expect(page.getByTestId("syncing-banner")).not.toBeVisible();
    await expect(page.getByTestId("conflict-notification")).not.toBeVisible();
  });

  test("can still navigate while offline", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Navigate to profile tab via tab bar text
    await page.getByRole("tab", {name: "Profile"}).click();
    await page.waitForTimeout(1000);

    // Navigate back to todos
    await page.getByRole("tab", {name: "Todos"}).click();
    await page.waitForTimeout(1000);

    // Banner should still be visible
    await expect(page.getByTestId("offline-banner")).toBeVisible();
  });

  test("banner disappears after successful API request while offline", async ({page}) => {
    // This tests auto-detection: if an API call succeeds, we're actually online
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Remove route blocks (simulating network returning) but don't dispatch online event
    await page.unroute("**/*");

    // Trigger a refetch by pulling to refresh or navigating
    await goOnline(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible();
  });

  test("offline banner persists across tab switches", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await page.getByTestId("todos-new-title-input").first().fill("Tab Switch");
    await page.getByTestId("todos-add-button").first().click();
    await page.waitForTimeout(1000);

    // Switch to profile tab
    await page.getByRole("tab", {name: "Profile"}).click();
    await page.waitForTimeout(1000);

    // Switch back to todos
    await page.getByRole("tab", {name: "Todos"}).click();
    await page.waitForTimeout(1000);

    // Banner should still be visible with pending count
    await expect(page.getByTestId("offline-banner")).toBeVisible();
    const bannerText = await page.getByTestId("offline-banner").textContent();
    expect(bannerText).toContain("pending");
  });
});
