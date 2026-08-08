import {expect, test} from "./fixtures/test";
import {getAdminToken, loginAsAdmin} from "./helpers/adminAuth";
import {mongoSupportsChangeStreams} from "./helpers/mongoReplicaSet";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

test.describe("Feature flags live refresh", () => {
  let supportsChangeStreams: boolean;

  test.beforeAll(async () => {
    supportsChangeStreams = await mongoSupportsChangeStreams();
  });

  test("todo summary card toggles when the flag is patched without a page reload", async ({
    page,
    request,
  }) => {
    test.skip(
      !supportsChangeStreams,
      "MongoDB must run as a replica set (hello.setName) for change-stream live flag updates"
    );

    const token = await getAdminToken(request);
    const listRes = await request.get(`${API_URL}/feature-flags/flags`, {
      headers: {authorization: `Bearer ${token}`},
    });
    expect(listRes.ok()).toBeTruthy();
    const listJson = (await listRes.json()) as {data?: Array<{_id?: string; key?: string}>};
    const flags = listJson.data ?? [];
    const summaryFlag = flags.find((f) => f.key === "todo-summary-card");
    const flagId = summaryFlag?._id;
    if (!flagId) {
      throw new Error("Expected seeded flag todo-summary-card with _id");
    }

    await loginAsAdmin(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});

    await expect(page.getByTestId("todos-summary-card").first()).toBeVisible({timeout: 10_000});

    const patchOff = await request.patch(`${API_URL}/feature-flags/flags/${flagId}`, {
      data: {enabled: false},
      headers: {authorization: `Bearer ${token}`},
    });
    expect(patchOff.ok()).toBeTruthy();

    await expect(page.getByTestId("todos-summary-card").first()).toBeHidden({timeout: 5000});

    const patchOn = await request.patch(`${API_URL}/feature-flags/flags/${flagId}`, {
      data: {enabled: true},
      headers: {authorization: `Bearer ${token}`},
    });
    expect(patchOn.ok()).toBeTruthy();

    await expect(page.getByTestId("todos-summary-card").first()).toBeVisible({timeout: 5000});
  });
});
