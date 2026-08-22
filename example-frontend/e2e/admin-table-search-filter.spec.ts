import {expect, test} from "./fixtures/test";
import {loginAsAdmin} from "./helpers/adminAuth";

test.describe("Admin table search and filters", () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdmin(page);
    await page.goto("/admin/Todo");
  });

  test("searches and applies a filter", async ({consoleGuard, page}) => {
    consoleGuard.allow("UTC is not a valid timezone");
    const search = page.getByTestId("admin-table-search");
    await expect(search).toBeVisible();
    await search.fill("OFFLINE");
    await expect(page.getByText("Try offline mode").locator("visible=true").first()).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByTestId("admin-filter-drawer")).toBeVisible();
    await expect(page.getByTestId("admin-filter-apply")).toBeDisabled();
    await page.getByTestId("admin-filter-completed").click();
    await expect(page.getByTestId("admin-filter-apply")).toBeEnabled();
    await page.getByTestId("admin-filter-apply").click();
    await expect(page.getByTestId("admin-filter-apply")).toBeDisabled();

    await page.getByTestId("admin-filter-clear-all").click();
    await expect(page.getByTestId("admin-filter-clear-all")).toBeDisabled();

    await expect(page.getByTestId("admin-table-selection-count")).toContainText("0 selected");
  });
});
