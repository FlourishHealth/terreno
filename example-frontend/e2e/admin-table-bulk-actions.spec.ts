import {expect, test} from "./fixtures/test";
import {getAdminToken, loginAsAdmin} from "./helpers/adminAuth";

test.describe("Admin table bulk actions", () => {
  test("selects rows and opens the action confirmation", async ({page, request}) => {
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

    await page.getByTestId("admin-action-menu").click();
    await page.getByText("Mark completed").click();
    await expect(page.getByTestId("admin-action-confirm-markComplete")).toBeVisible();
  });
});
