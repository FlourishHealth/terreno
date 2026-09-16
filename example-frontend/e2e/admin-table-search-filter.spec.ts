import {expect, test} from "./fixtures/test";
import {getAdminToken, loginAsAdmin} from "./helpers/adminAuth";
import {waitForAdminTable} from "./helpers/adminUi";

test.describe("Admin table search and filters", () => {
  test("searches and applies a filter", async ({consoleGuard, page, request}) => {
    consoleGuard.allow("UTC is not a valid timezone");
    const apiUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
    const token = await getAdminToken(request);
    const createResponse = await request.post(`${apiUrl}/todos`, {
      data: {title: "Try offline mode"},
      headers: {authorization: `Bearer ${token}`},
    });
    expect(createResponse.ok()).toBeTruthy();

    await loginAsAdmin(page);
    await page.goto("/admin/Todo");
    await waitForAdminTable(page);

    const search = page.getByTestId("data-table-search");
    await expect(search).toBeVisible();
    await search.fill("no-such-todo-1177");
    await expect(page.getByText("No items found.")).toBeVisible({timeout: 15_000});
    await expect(search).toBeVisible();

    await search.clear();
    await expect(page.getByText("Try offline mode").locator("visible=true").first()).toBeVisible({
      timeout: 15_000,
    });

    const filter = page.getByTestId("data-table-filter-completed");
    await filter.getByTestId("data-table-filter-completed.trigger").click();
    await page.getByTestId("data-table-filter-completed.switch").click();
    await page.getByTestId("data-table-filter-completed.apply").click();

    await filter.getByTestId("data-table-filter-completed.trigger").click();
    await page.getByTestId("data-table-filter-completed.clear").click();
    await page.getByTestId("data-table-filter-completed.apply").click();

    await expect(page.getByTestId("admin-table-selection-count")).toContainText("0 selected");
  });
});
