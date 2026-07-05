/**
 * Core RTK offline-sync flows: banner visibility, queueing each mutation type while
 * offline, conflict detection, and queue persistence across reload.
 *
 * Runs against the RTK todos path (use-syncdb flag off) as a dedicated user so it can
 * execute in parallel with the other offline-* and todos specs.
 */
import {expect, test} from "./fixtures/test";
import {OFFLINE_SYNC_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import {
  allowOfflineNoise,
  createTodoViaApi,
  goOffline,
  goOnline,
  updateTodoViaApi,
} from "./helpers/offlineHelpers";
import {setSyncDbFlag} from "./helpers/syncdbFlag";
import {clearTodosAs} from "./helpers/todosApi";

const USER = OFFLINE_SYNC_USER;
const SYNC_TIMEOUT = 15_000;

test.describe("Offline Sync", () => {
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

    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    await goOnline(page);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
    await expect(page.getByText("Offline Todo").first()).toBeVisible({timeout: SYNC_TIMEOUT});
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

    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    await goOnline(page);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
    // The toggle replayed — the completed section renders.
    await page.getByTestId("todos-completed-section-toggle-clickable").waitFor({
      state: "visible",
      timeout: SYNC_TIMEOUT,
    });
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

    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    await goOnline(page);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible({
      timeout: SYNC_TIMEOUT,
    });
  });

  test("detects conflict when another client updates the same document", async ({page}) => {
    const todo = await createTodoViaApi("Conflict Test", USER);
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
    // The queued mutation is registered once the banner reports it pending.
    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    await updateTodoViaApi(todoId, {title: "Server Updated Title"}, USER);

    await goOnline(page);

    await page.getByTestId("conflict-notification").waitFor({state: "visible", timeout: 10000});
    await expect(page.getByTestId("conflict-notification")).toBeVisible();

    const dismissBtn = page.locator('[data-testid^="conflict-dismiss-"]').first();
    await dismissBtn.click();

    await page.getByTestId("conflict-notification").waitFor({state: "hidden"});
  });

  // Product bug (pre-existing, verified against the pre-split offline.spec.ts as
  // well): reloading while offline strands the app on the ConsentNavigator's
  // "Failed to load consent forms" error screen — the pending-consents fetch fails
  // with the network down and blocks the todos screen from ever mounting, so the
  // queued mutation can't be observed replaying after the reload.
  test.fixme("persists offline queue across page reload", async ({page}) => {
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
    await expect(page.getByTestId("offline-banner")).toContainText("pending");
    // Give redux-persist a beat to flush the queued mutation to storage before the
    // reload — the pending banner only proves the in-memory queue was updated.
    await page.waitForTimeout(1000);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});

    await goOnline(page);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
  });
});
