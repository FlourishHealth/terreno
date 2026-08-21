import {expect, test} from "./fixtures/test";
import {getAdminToken, loginAsAdmin} from "./helpers/adminAuth";

test.describe("Admin table bulk actions", () => {
  test("selects rows and opens the action confirmation", async ({consoleGuard, page, request}) => {
    consoleGuard.allow("UTC is not a valid timezone");
    const apiUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
    const token = await getAdminToken(request);
    const createResponse = await request.post(`${apiUrl}/todos`, {
      data: {title: "Bulk action test"},
      headers: {authorization: `Bearer ${token}`},
    });
    expect(createResponse.ok()).toBeTruthy();

    await loginAsAdmin(page);
    await page.goto("/admin/Todo");
    await expect(page.getByTestId("admin-table-select-all")).toBeVisible();
    await page.getByTestId("admin-table-select-all").click();
    await expect(page.getByTestId("admin-table-selection-count")).not.toContainText("0 selected");

    await page.locator('input[value="Bulk actions…"]').click();
    await page.getByText("Mark completed").click();
    await expect(page.getByText("Confirm bulk action")).toBeVisible();
  });
});
