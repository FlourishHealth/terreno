/**
 * Verifies the RTK path with the use-syncdb flag off (AC-15) and leaves the flag
 * disabled. Scheduled after every flag-on syncdb spec (see the syncdb-flag-off
 * project in playwright.config.ts) so it both proves the fallback path and restores
 * the default flag state for anything that runs later.
 */
import {expect, test} from "./fixtures/test";
import {TEST_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import {setSyncDbFlag} from "./helpers/syncdbFlag";
import {allowSyncDbNoise, CONVERGE_TIMEOUT} from "./helpers/syncdbSuite";
import {clearTodosAs} from "./helpers/todosApi";

test.describe("SyncDB flag off leaves the RTK path unchanged (AC-15)", () => {
  test.beforeAll(async () => {
    await setSyncDbFlag(false);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(TEST_USER);
    await loginAs(page);
    await page.goto("/");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("RTK todos CRUD works and no syncdb UI renders", async ({page}) => {
    await expect(page.getByTestId("sync-status-banner")).toHaveCount(0);
    await expect(page.getByTestId("syncdb-dev-panel")).toHaveCount(0);

    // Create
    await page.getByTestId("todos-new-title-input").first().fill("RTK path todo");
    await page.getByTestId("todos-add-button").first().click();
    const item = page.locator('[data-testid^="todos-item-"]').filter({hasText: "RTK path todo"});
    await item.waitFor({state: "visible"});

    // Toggle
    const testId = (await item.getAttribute("data-testid")) ?? "";
    const id = testId.replace("todos-item-", "");
    await page.getByTestId(`todos-toggle-${id}-clickable`).first().click();
    await page.getByTestId("todos-completed-section-toggle-clickable").waitFor({state: "visible"});

    // Delete
    await page.getByTestId(`todos-delete-${id}`).first().click();
    await expect(page.getByTestId(`todos-item-${id}`)).toBeHidden({timeout: CONVERGE_TIMEOUT});
  });
});
