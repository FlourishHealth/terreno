import {expect, test} from "./fixtures/test";
import {loginAs} from "./helpers/login";
import {allowSyncDbNoise, openSyncTodos} from "./helpers/syncdbSuite";

test.describe("notifications", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await loginAs(page);
    await openSyncTodos(page);
  });

  test("mark read keeps inbox modal open", async ({page}) => {
    await page.getByTestId("notification-send-test-button").click();
    await expect(page.getByTestId("notification-bell-badge")).toBeVisible({timeout: 15_000});

    await page.getByTestId("notification-bell-button").click();
    const modal = page.getByTestId("notification-inbox-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("notification-inbox-list")).toBeVisible();

    const markRead = modal.getByText("Mark read").first();
    await markRead.click();

    await expect(modal).toBeVisible();
    await expect(page.getByTestId("notification-inbox-list")).toBeVisible();
  });

  test("test notification unread badge persists without refresh", async ({page}) => {
    const badge = page.getByTestId("notification-bell-badge");
    await page.waitForTimeout(5000);
    const initialCount = (await badge.isVisible())
      ? Number.parseInt((await badge.textContent()) ?? "0", 10)
      : 0;

    await page.getByTestId("notification-send-test-button").click();
    await expect(badge).toBeVisible({timeout: 15_000});

    const expectedCount = String(initialCount + 1);
    await expect(badge).toHaveText(expectedCount, {timeout: 5000});

    await page.waitForTimeout(5000);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(expectedCount);
  });
});
