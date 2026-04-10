import {expect, test} from "@playwright/test";
import {getAdminToken, loginAsAdmin} from "./helpers/adminAuth";
import {loginAs} from "./helpers/login";

test.describe("Admin Panel", () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
  });

  test("admin panel renders model list", async ({page}) => {
    await page.getByTestId("admin-model-card-User").waitFor({state: "visible"});
    await expect(page.getByTestId("admin-model-card-User")).toBeVisible();
    await expect(page.getByTestId("admin-model-card-Todo")).toBeVisible();
  });

  test("admin panel shows custom screens", async ({page}) => {
    await page.getByTestId("admin-custom-screen-card-ai-admin").waitFor({state: "visible"});
    await expect(page.getByTestId("admin-custom-screen-card-ai-admin")).toBeVisible();
  });

  test("can navigate to model table", async ({page}) => {
    await page.getByTestId("admin-model-card-Todo").waitFor({state: "visible"});
    await page.getByTestId("admin-model-card-Todo").click();
    await page.getByTestId("admin-create-button").waitFor({state: "visible"});
    await expect(page.getByTestId("admin-create-button")).toBeVisible();
  });

  test("can navigate to create form", async ({page}) => {
    await page.getByTestId("admin-model-card-Todo").waitFor({state: "visible"});
    await page.getByTestId("admin-model-card-Todo").click();
    await page.getByTestId("admin-create-button").waitFor({state: "visible"});
    await page.getByTestId("admin-create-button").click();
    await page.getByTestId("admin-save-button").waitFor({state: "visible"});
    await expect(page.getByTestId("admin-save-button")).toBeVisible();
  });

  test("can create a todo via admin", async ({page, request}) => {
    const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
    const token = await getAdminToken(request);

    // Get the admin user's ID for the required ownerId field
    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: {authorization: `Bearer ${token}`},
    });
    const meData = (await meRes.json()) as any;
    const adminUserId = meData._id ?? meData.data?._id;

    // Create a todo via the admin API
    const todoTitle = `Admin Todo ${Date.now()}`;
    const createRes = await request.post(`${API_URL}/admin/todos`, {
      data: {title: todoTitle, ownerId: adminUserId},
      headers: {authorization: `Bearer ${token}`},
    });
    expect(createRes.ok()).toBeTruthy();

    // Navigate to the Todos admin table
    await page.getByTestId("admin-model-card-Todo").waitFor({state: "visible"});
    await page.getByTestId("admin-model-card-Todo").click();
    await page.waitForLoadState("networkidle");

    // Verify the todo appears in the table
    await page.getByText(todoTitle).first().waitFor({state: "visible"});
    await expect(page.getByText(todoTitle).first()).toBeVisible();
  });

  test("admin panel shows configuration card", async ({page}) => {
    await page.getByTestId("admin-configuration-card").waitFor({state: "visible"});
    await expect(page.getByTestId("admin-configuration-card")).toBeVisible();
  });
});

test.describe("Admin Access Control", () => {
  test("non-admin user cannot see admin button in profile", async ({page}) => {
    await loginAs(page);
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("profile-name-input").first().waitFor({state: "visible"});
    await expect(page.getByTestId("profile-admin-button")).not.toBeVisible();
  });
});
