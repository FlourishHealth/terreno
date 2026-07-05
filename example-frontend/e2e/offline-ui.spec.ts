/**
 * RTK offline-sync UI details: pending-count banner accuracy, optimistic updates
 * while offline, and edge cases (navigation, tab switches, recovery detection).
 *
 * Runs against the RTK todos path (use-syncdb flag off) as a dedicated user so it can
 * execute in parallel with the other offline-* and todos specs.
 */
import {expect, test} from "./fixtures/test";
import {OFFLINE_UI_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import {allowOfflineNoise, goOffline, goOnline} from "./helpers/offlineHelpers";
import {setSyncDbFlag} from "./helpers/syncdbFlag";
import {clearTodosAs} from "./helpers/todosApi";

const USER = OFFLINE_UI_USER;
const SYNC_TIMEOUT = 15_000;

test.beforeAll(async () => {
  await setSyncDbFlag(false);
});

test.beforeEach(async ({page, consoleGuard}) => {
  allowOfflineNoise(consoleGuard);
  await clearTodosAs(USER);
  await loginAs(page, USER);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
});

test.describe("Offline Sync — Queue Count & Banner Accuracy", () => {
  test("banner reflects correct pending count as mutations are queued", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const banner = page.getByTestId("offline-banner");
    for (const [index, title] of ["Count 1", "Count 2", "Count 3"].entries()) {
      await page.getByTestId("todos-new-title-input").first().fill(title);
      await page.getByTestId("todos-add-button").first().click();
      await expect(banner).toContainText(`${index + 1}`);
      await expect(banner).toContainText("pending");
    }
  });

  test("banner shows singular form for 1 pending change", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await page.getByTestId("todos-new-title-input").first().fill("Singular");
    await page.getByTestId("todos-add-button").first().click();

    const banner = page.getByTestId("offline-banner");
    await expect(banner).toContainText("1 pending change ");
    await expect(banner).not.toContainText("changes");
  });

  test("banner shows plural form for multiple pending changes", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await page.getByTestId("todos-new-title-input").first().fill("Plural A");
    await page.getByTestId("todos-add-button").first().click();
    await expect(page.getByTestId("offline-banner")).toContainText("1");
    await page.getByTestId("todos-new-title-input").first().fill("Plural B");
    await page.getByTestId("todos-add-button").first().click();

    await expect(page.getByTestId("offline-banner")).toContainText("changes");
  });
});

test.describe("Offline Sync — Optimistic UI", () => {
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
    await expect(page.getByTestId("offline-banner")).toBeVisible();

    // Navigate back to todos
    await page.getByRole("tab", {name: "Todos"}).click();
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});

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

    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
  });

  test("offline banner persists across tab switches", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    await page.getByTestId("todos-new-title-input").first().fill("Tab Switch");
    await page.getByTestId("todos-add-button").first().click();
    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    // Switch to profile tab
    await page.getByRole("tab", {name: "Profile"}).click();
    await expect(page.getByTestId("offline-banner")).toBeVisible();

    // Switch back to todos
    await page.getByRole("tab", {name: "Todos"}).click();
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});

    // Banner should still be visible with pending count
    await expect(page.getByTestId("offline-banner")).toBeVisible();
    await expect(page.getByTestId("offline-banner")).toContainText("pending");
  });
});
