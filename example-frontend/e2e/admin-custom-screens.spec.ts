import {expect, test} from "./fixtures/test";
import {loginAsAdmin} from "./helpers/adminAuth";

test.describe("Admin contributed custom screens", () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdmin(page);
  });

  test("renders the Documents browser through AdminScreenRouter", async ({consoleGuard, page}) => {
    consoleGuard.allow("Failed to load resource: the server responded with a status of 503");
    await page.goto("/admin/documents");
    await expect(page.getByText("Documents").first()).toBeVisible();
    await expect(page.getByTestId("document-refresh-button")).toBeVisible();
  });

  test("renders the AI request explorer through AdminScreenRouter", async ({
    consoleGuard,
    page,
  }) => {
    consoleGuard.allow("UTC is not a valid timezone");
    await page.goto("/admin/ai-requests");
    await expect(page.getByText("AI Request Explorer").first()).toBeVisible();
  });
});
