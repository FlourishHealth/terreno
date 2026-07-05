/**
 * RTK offline-sync flows for batches of queued mutations: multiple creates, mixed
 * create/update, create-then-delete, and the syncing indicator during replay.
 *
 * Runs against the RTK todos path (use-syncdb flag off) as a dedicated user so it can
 * execute in parallel with the other offline-* and todos specs.
 */
import {expect, test} from "./fixtures/test";
import {OFFLINE_MUTATIONS_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import {allowOfflineNoise, goOffline, goOnline} from "./helpers/offlineHelpers";
import {setSyncDbFlag} from "./helpers/syncdbFlag";
import {clearTodosAs} from "./helpers/todosApi";

const USER = OFFLINE_MUTATIONS_USER;
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

test.describe("Offline Sync — Multiple Mutations", () => {
  test("queues multiple creates offline and syncs all on reconnect", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    const titles = ["First Offline", "Second Offline", "Third Offline"];
    for (const [index, title] of titles.entries()) {
      await page.getByTestId("todos-new-title-input").first().fill(title);
      await page.getByTestId("todos-add-button").first().click();
      await expect(page.getByTestId("offline-banner")).toContainText(`${index + 1}`);
    }
    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    await goOnline(page);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
    await expect(page.getByText("First Offline").first()).toBeVisible({timeout: SYNC_TIMEOUT});
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
    await expect(page.getByTestId("offline-banner")).toContainText("1");

    // Toggle the existing todo completed
    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();
    await expect(page.getByTestId("offline-banner")).toContainText("2");
    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    await goOnline(page);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
    await expect(page.getByText("New While Offline").first()).toBeVisible({timeout: SYNC_TIMEOUT});
    // The existing todo should now be in the completed section
    await page.getByTestId("todos-completed-section-toggle-clickable").waitFor({
      state: "visible",
      timeout: SYNC_TIMEOUT,
    });
  });

  // Product bug (pre-existing, verified against the pre-split offline.spec.ts as
  // well): a delete queued behind an offline create replays against the optimistic
  // temp id (DELETE /todos/temp-postTodos-... → 500) instead of the real id from the
  // create's response, so the todo survives and the queue reports a failed replay.
  test.fixme("handles create followed by delete of same item offline", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Create a todo offline
    await page.getByTestId("todos-new-title-input").first().fill("Create Then Delete");
    await page.getByTestId("todos-add-button").first().click();

    // The optimistic item should appear
    await expect(page.getByText("Create Then Delete").first()).toBeVisible();

    // Now delete it while still offline. A todo that only exists as a queued create
    // has no server id yet, so the delete is queued as a second mutation rather than
    // removing the optimistic item — the banner count is the reliable signal.
    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");
    const deleteBtn = page.getByTestId(`todos-delete-${itemId}`).filter({visible: true}).first();
    await deleteBtn.waitFor({state: "visible"});
    await deleteBtn.click();
    await expect(page.getByTestId("offline-banner")).toContainText("2");

    await goOnline(page);

    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
    // After sync, the net result should be no todos (created then deleted)
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible({
      timeout: SYNC_TIMEOUT,
    });
  });
});

test.describe("Offline Sync — Syncing Indicator", () => {
  test("shows syncing banner during replay", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Queue multiple mutations for a longer sync window
    const titles = ["Sync A", "Sync B", "Sync C"];
    for (const [index, title] of titles.entries()) {
      await page.getByTestId("todos-new-title-input").first().fill(title);
      await page.getByTestId("todos-add-button").first().click();
      await expect(page.getByTestId("offline-banner")).toContainText(`${index + 1}`);
    }

    // Slow each replayed request down so the transient syncing banner stays up long
    // enough to observe — an instant replay can finish between assertion polls. The
    // pattern differs from goOffline/goOnline's so their unroute leaves it alone.
    await page.route("**/todos", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await goOnline(page);

    // While replaying, the banner (same offline-banner testID — OfflineBanner keeps
    // its root testID in the syncing state) switches to the syncing message.
    await expect(page.getByTestId("offline-banner")).toContainText("Syncing offline changes", {
      timeout: 5000,
    });
    await page.unroute("**/todos");

    // Eventually syncing completes and the banner disappears entirely
    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
  });
});
