/**
 * RTK offline-sync flows for multi-document conflicts and unstable connectivity
 * (rapid offline/online flapping while mutations are queued).
 *
 * Runs against the RTK todos path (use-syncdb flag off) as a dedicated user so it can
 * execute in parallel with the other offline-* and todos specs.
 */
import {expect, test} from "./fixtures/test";
import {OFFLINE_CONFLICTS_USER} from "./fixtures/testUsers";
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

const USER = OFFLINE_CONFLICTS_USER;
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

test.describe("Offline Sync — Multiple Conflicts", () => {
  test("shows multiple conflict notifications for different documents", async ({page}) => {
    // Create two todos via the API
    const todoA = await createTodoViaApi("Conflict A", USER);
    const todoB = await createTodoViaApi("Conflict B", USER);

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
    await expect(page.getByTestId("offline-banner")).toContainText("1");

    const toggleB = page
      .getByTestId(`todos-toggle-${todoB._id}-clickable`)
      .filter({visible: true})
      .first();
    await toggleB.waitFor({state: "visible"});
    await toggleB.click();
    await expect(page.getByTestId("offline-banner")).toContainText("2");

    // Update both via API (simulate another client)
    await updateTodoViaApi(todoA._id, {title: "Server A"}, USER);
    await updateTodoViaApi(todoB._id, {title: "Server B"}, USER);

    await goOnline(page);

    // Multiple conflict notifications should appear
    const conflicts = page.locator('[data-testid="conflict-notification"]');
    await expect(conflicts).toHaveCount(2, {timeout: SYNC_TIMEOUT});
  });

  test("dismissing one conflict does not affect others", async ({page}) => {
    const todoA = await createTodoViaApi("Dismiss A", USER);
    const todoB = await createTodoViaApi("Dismiss B", USER);

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
    await expect(page.getByTestId("offline-banner")).toContainText("1");

    const toggleB = page
      .getByTestId(`todos-toggle-${todoB._id}-clickable`)
      .filter({visible: true})
      .first();
    await toggleB.waitFor({state: "visible"});
    await toggleB.click();
    await expect(page.getByTestId("offline-banner")).toContainText("2");

    await updateTodoViaApi(todoA._id, {title: "Server Dismiss A"}, USER);
    await updateTodoViaApi(todoB._id, {title: "Server Dismiss B"}, USER);

    await goOnline(page);

    const conflicts = page.locator('[data-testid="conflict-notification"]');
    await expect(conflicts).toHaveCount(2, {timeout: SYNC_TIMEOUT});

    // Dismiss only the first conflict
    const firstDismiss = page.locator('[data-testid^="conflict-dismiss-"]').first();
    await firstDismiss.click();

    // One conflict should remain
    await expect(conflicts).toHaveCount(1);
  });
});

test.describe("Offline Sync — Network Flapping", () => {
  test("recovers cleanly from rapid offline/online toggling", async ({page}) => {
    await goOffline(page);
    await page.getByTestId("offline-banner").waitFor({state: "visible"});

    // Create a todo while offline
    await page.getByTestId("todos-new-title-input").first().fill("Flap Test");
    await page.getByTestId("todos-add-button").first().click();
    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    // Rapidly toggle connectivity. The short sleeps are deliberate: the point is to
    // flip the network mid-replay, so there is no UI state to await between flips.
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

    // Should recover and sync successfully without duplicates
    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
    await expect(page.getByText("Flap Test")).toHaveCount(1, {timeout: SYNC_TIMEOUT});
  });

  // Product bug (pre-existing, verified against the pre-split offline.spec.ts as
  // well): a brief offline flap during replay aborts the list refetch and leaves the
  // RTK todos cache empty — the UI shows the empty state and never recovers even
  // after connectivity stabilizes.
  test.fixme("does not lose queued mutations during connectivity flapping", async ({page}) => {
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
    await expect(page.getByTestId("offline-banner")).toContainText("pending");

    // Brief online flap (deliberately not long enough to fully sync)
    await goOnline(page);
    await page.waitForTimeout(100);
    await goOffline(page);
    await page.waitForTimeout(500);

    // Stabilize online
    await goOnline(page);

    // The delete should have eventually synced
    await expect(page.getByTestId("offline-banner")).not.toBeVisible({timeout: SYNC_TIMEOUT});
    // Only the second todo should remain
    const items = page.locator('[data-testid^="todos-item-"]').filter({visible: true});
    await expect(items).toHaveCount(1, {timeout: SYNC_TIMEOUT});
  });
});
