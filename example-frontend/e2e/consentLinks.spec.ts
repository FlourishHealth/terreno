import {expect, test} from "./fixtures/test";
import {getAdminToken} from "./helpers/adminAuth";
import {createConsentForm, deleteConsentForm} from "./helpers/consentForms";
import {
  generateConsentLink,
  getAuditResponseCount,
  signupAndGetUserId,
} from "./helpers/consentLinks";

const LINK_USER = {
  email: "e2e-link-user@terreno.dev",
  name: "E2E Link User",
  password: "LinkPassword123!",
};

test.describe("Signed Consent Links", () => {
  let adminToken: string;
  let consentFormId: string;
  let userId: string;

  test.beforeAll(async ({request}) => {
    adminToken = await getAdminToken(request);
    userId = await signupAndGetUserId(request, LINK_USER);
  });

  test.beforeEach(async ({request}) => {
    consentFormId = await createConsentForm(request, adminToken);
  });

  test.afterEach(async ({request}) => {
    if (consentFormId) {
      await deleteConsentForm(request, adminToken, consentFormId);
    }
  });

  test("user completes a consent via a signed link without logging in", async ({
    page,
    request,
    consoleGuard,
  }) => {
    // Background authenticated queries (e.g. feature flags) fail on this public,
    // logged-out page — that's expected.
    consoleGuard.allow("No token found");
    const before = await getAuditResponseCount(request, adminToken, userId);

    const {token} = await generateConsentLink(request, adminToken, {
      consentFormIds: [consentFormId],
      userId,
    });

    // Visit the public signing page with no authenticated session.
    await page.goto(`/consents/sign?token=${token}`);

    // The consent form renders for the link's user.
    await page.getByTestId("consent-form-agree-button").waitFor({state: "visible"});
    await page.getByTestId("consent-form-agree-button").click();

    // After submitting, the completion state is shown.
    await page.getByTestId("consent-link-complete").waitFor({state: "visible"});
    await expect(page.getByTestId("consent-link-complete")).toBeVisible();

    // The response was recorded for the link's user.
    await expect
      .poll(async () => getAuditResponseCount(request, adminToken, userId))
      .toBe(before + 1);
  });

  test("shows an error for an invalid token", async ({page, consoleGuard}) => {
    consoleGuard.allow("No token found");
    // The browser logs the intentional 404 from loading an invalid link.
    consoleGuard.allow("Failed to load resource");

    await page.goto("/consents/sign?token=not-a-valid-token");

    await page.getByTestId("consent-link-error").waitFor({state: "visible"});
    await expect(page.getByTestId("consent-link-error")).toBeVisible();
  });

  test("rejects a revoked link", async ({page, request, consoleGuard}) => {
    consoleGuard.allow("No token found");
    // The browser logs the intentional 410 from loading a revoked link.
    consoleGuard.allow("Failed to load resource");
    consentFormId = await createConsentForm(request, adminToken);
    const {token, _id} = await generateConsentLink(request, adminToken, {
      consentFormIds: [consentFormId],
      userId,
    });

    // Revoke the link before it is used.
    const revokeRes = await request.post(
      `${process.env.BACKEND_URL ?? "http://localhost:4000"}/consents/links/${_id}/revoke`,
      {headers: {authorization: `Bearer ${adminToken}`}}
    );
    expect(revokeRes.ok()).toBeTruthy();

    await page.goto(`/consents/sign?token=${token}`);
    await page.getByTestId("consent-link-error").waitFor({state: "visible"});
    await expect(page.getByTestId("consent-link-error")).toBeVisible();
  });
});
