import {expect, test} from "./fixtures/test";
import {loginAs} from "./helpers/login";
import {allowSyncDbNoise, openSyncTodos} from "./helpers/syncdbSuite";

test.describe("notifications", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await loginAs(page);
    await openSyncTodos(page);
  });

  test("bell opens and closes the notification drawer", async ({page}) => {
    await page.getByTestId("notification-bell-button").click();
    const drawer = page.getByTestId("notification-drawer");
    await expect(drawer).toBeVisible();

    await page.getByTestId("notification-send-test-button").click();
    await expect(page.getByTestId("notification-bell-badge")).toBeVisible({timeout: 15_000});
    await expect(page.getByTestId("notification-inbox-list")).toBeVisible();

    const markRead = drawer.getByText("Mark read").first();
    await markRead.click();

    await expect(drawer).toBeVisible();
    await expect(page.getByTestId("notification-inbox-list")).toBeVisible();

    await drawer.getByTestId("notification-drawer-bell-button").click();
    await expect(drawer).not.toBeVisible();
  });

  test("test notification unread badge persists without refresh", async ({page}) => {
    const badge = page.getByTestId("notification-bell-badge").first();
    await page.waitForTimeout(5000);
    const initialCount = (await badge.isVisible())
      ? Number.parseInt((await badge.textContent()) ?? "0", 10)
      : 0;

    await page.getByTestId("notification-bell-button").click();
    await page.getByTestId("notification-send-test-button").click();
    await expect(badge).toBeVisible({timeout: 15_000});

    const expectedCount = String(initialCount + 1);
    await expect(badge).toHaveText(expectedCount, {timeout: 5000});

    await page.waitForTimeout(5000);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(expectedCount);
  });

  test("view all includes archived notifications", async ({page}) => {
    await page.getByTestId("notification-bell-button").click();
    await page.getByTestId("notification-view-all-button").click();

    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByText("All notifications")).toBeVisible();
    await expect(page.getByTestId("all-notifications-active-list")).toBeVisible();
    await expect(page.getByTestId("all-notifications-archived-list")).toBeVisible();
    await expect(page.getByText("Archived example")).toBeVisible();
  });
});
