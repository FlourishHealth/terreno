import {expect, test} from "./fixtures/test";
import {getAdminToken, loginAsAdmin} from "./helpers/adminAuth";
import {waitForAdminTable} from "./helpers/adminUi";

const REPRO_TITLE = "Review the sync status banner — admin window verified";

test.describe("Admin Todo title update-depth investigation", () => {
  test("types the reported title on /admin/Todo/:id without maximum update depth", async ({
    consoleGuard,
    page,
    request,
  }) => {
    consoleGuard.allow("UTC is not a valid timezone");
    consoleGuard.allow("[agent:AdminModelForm]");
    consoleGuard.allow("[agent:TextField]");

    const apiUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
    const token = await getAdminToken(request);
    const seedTitle = `Depth probe ${Date.now()}`;

    const createResponse = await request.post(`${apiUrl}/todos`, {
      data: {title: seedTitle},
      headers: {authorization: `Bearer ${token}`},
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as {data?: {_id?: string}};
    const createdId = created.data?._id;
    expect(createdId).toBeTruthy();

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await loginAsAdmin(page);
    await page.goto("/admin/Todo");
    await waitForAdminTable(page);
    await page.getByText(seedTitle).locator("visible=true").first().click();
    await page.getByTestId("admin-save-button").waitFor({state: "visible", timeout: 15_000});

    const titleField = page.getByTestId("admin-field-title");
    await titleField.click();
    await titleField.fill("");
    await titleField.pressSequentially(REPRO_TITLE, {delay: 5});

    const agentLogs = await page.evaluate(() => {
      const logs = (globalThis as typeof globalThis & {__agentAdminModelFormLogs?: unknown[]})
        .__agentAdminModelFormLogs;
      return logs ?? [];
    });

    const depthErrors = pageErrors.filter((m) => m.includes("Maximum update depth exceeded"));
    const consoleDepthErrors = consoleGuard
      .messages()
      .filter((m) => m.text.includes("Maximum update depth exceeded"));

    // eslint-disable-next-line no-console
    console.info(
      "[repro-summary]",
      JSON.stringify({
        agentLogCount: agentLogs.length,
        consoleDepthErrors,
        finalTitle: await titleField.inputValue(),
        pageErrors: depthErrors,
      })
    );

    expect(depthErrors, `pageerror: ${depthErrors.join("; ")}`).toHaveLength(0);
    expect(
      consoleDepthErrors,
      `console: ${consoleDepthErrors.map((m) => m.text).join("; ")}`
    ).toHaveLength(0);
    await expect(titleField).toHaveValue(REPRO_TITLE);
  });
});
