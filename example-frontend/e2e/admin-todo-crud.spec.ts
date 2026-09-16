import {DateTime} from "luxon";
import {expect, test} from "./fixtures/test";
import {getAdminToken, loginAsAdmin} from "./helpers/adminAuth";
import {waitForAdminTable} from "./helpers/adminUi";

/**
 * Task 1.7: Todos changelist create → edit → delete.
 * Create uses the app `/todos` POST because admin create strips readonly `ownerId`.
 * Edit and delete go through the admin form (login + consent already handled by loginAsAdmin).
 */
test.describe("Admin Todo CRUD smoke", () => {
  test("creates, edits, and deletes a Todo from the admin table", async ({
    consoleGuard,
    page,
    request,
  }) => {
    consoleGuard.allow("UTC is not a valid timezone");
    // After delete, the form's RTK read can refetch GET /admin/todos/:id and Chrome
    // logs that 404 as console.error before the query unsubscribes.
    consoleGuard.allow("Failed to load resource: the server responded with a status of 404");
    const apiUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
    const token = await getAdminToken(request);
    const createdTitle = `Admin CRUD ${DateTime.now().toMillis()}`;
    const refreshedTitle = `${createdTitle} refreshed`;
    const editedTitle = `${refreshedTitle} edited`;

    const createResponse = await request.post(`${apiUrl}/todos`, {
      data: {title: createdTitle},
      headers: {authorization: `Bearer ${token}`},
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as {data?: {_id?: string}};
    const createdId = created.data?._id;
    expect(createdId).toBeTruthy();

    await loginAsAdmin(page);
    await page.goto("/admin/Todo");
    await waitForAdminTable(page);
    await expect(page.getByTestId("admin-table-refresh")).toBeVisible();
    await expect(page.getByText(createdTitle).locator("visible=true").first()).toBeVisible({
      timeout: 15_000,
    });

    const updateResponse = await request.patch(`${apiUrl}/todos/${createdId}`, {
      data: {title: refreshedTitle},
      headers: {authorization: `Bearer ${token}`},
    });
    expect(updateResponse.ok()).toBeTruthy();
    // A known admin-window id receives the live `{collection}|admin` delta.
    await expect(page.getByText(refreshedTitle).locator("visible=true").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("admin-table-refresh").click();
    await expect(page.getByText(refreshedTitle).locator("visible=true").first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByText(refreshedTitle).locator("visible=true").first().click();
    await page.getByTestId("admin-save-button").waitFor({state: "visible", timeout: 15_000});
    await page.getByTestId("admin-field-title").fill(editedTitle);
    await page.getByTestId("admin-save-button").click();
    await waitForAdminTable(page);
    await expect(page.getByText(editedTitle).locator("visible=true").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(refreshedTitle, {exact: true}).locator("visible=true")).toHaveCount(
      0
    );

    await page.getByText(editedTitle).locator("visible=true").first().click();
    await page.getByTestId("admin-delete-button").waitFor({state: "visible", timeout: 15_000});

    // A windowed delete leaves the cached REST membership page stale, so the changelist must
    // refetch it on its own — the Refresh button is deliberately never pressed after this point.
    let membershipRequestsAfterDelete = 0;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/admin/todos" && request.method() === "GET") {
        membershipRequestsAfterDelete += 1;
      }
    });

    await page.getByTestId("admin-delete-button").click();
    await page.getByRole("button", {name: "Confirm"}).click();
    await waitForAdminTable(page);
    await expect(page.getByText(editedTitle).locator("visible=true")).toHaveCount(0);
    await expect
      .poll(() => membershipRequestsAfterDelete, {timeout: 15_000})
      .toBeGreaterThanOrEqual(1);
  });
});
