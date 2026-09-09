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
