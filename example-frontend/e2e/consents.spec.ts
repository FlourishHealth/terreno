import {expect, test} from "@playwright/test";
import {getAdminToken} from "./helpers/adminAuth";
import {createConsentForm, deleteConsentForm} from "./helpers/consentForms";
import {loginAs} from "./helpers/login";

test.describe("Consent Flow", () => {
  let adminToken: string;
  let consentFormId: string;

  test.beforeAll(async ({request}) => {
    adminToken = await getAdminToken(request);
  });

  test.beforeEach(async ({request}) => {
    // Create a fresh consent form so the test user has a pending consent
    consentFormId = await createConsentForm(request, adminToken);
  });

  test.afterEach(async ({request}) => {
    if (consentFormId) {
      await deleteConsentForm(request, adminToken, consentFormId);
    }
  });

  test("consent navigator blocks when pending consents exist", async ({page}) => {
    await loginAs(page);
    // The consent navigator should intercept and show the consent form
    await page.getByTestId("consent-form-agree-button").waitFor({state: "visible"});
    await expect(page.getByTestId("consent-form-agree-button")).toBeVisible();
  });

  test("user can accept consent form", async ({page}) => {
    await loginAs(page);
    await page.getByTestId("consent-form-agree-button").waitFor({state: "visible"});
    await page.getByTestId("consent-form-agree-button").click();

    // After accepting, the app should load normally (todos screen is the default)
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
    await expect(page.getByTestId("todos-new-title-input").first()).toBeVisible();
  });

  test("consent history shows accepted consents", async ({page}) => {
    // Accept the consent first
    await loginAs(page);
    await page.getByTestId("consent-form-agree-button").waitFor({state: "visible"});
    await page.getByTestId("consent-form-agree-button").click();
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});

    // Navigate to consents tab
    await page.goto("/consents");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("consent-history-list").waitFor({state: "visible"});
    await expect(page.getByTestId("consent-history-list")).toBeVisible();
  });
});

test.describe("Consent with Checkboxes", () => {
  let adminToken: string;
  let consentFormId: string;

  test.beforeAll(async ({request}) => {
    adminToken = await getAdminToken(request);
  });

  test.afterEach(async ({request}) => {
    if (consentFormId) {
      await deleteConsentForm(request, adminToken, consentFormId);
    }
  });

  test("consent form shows checkboxes when configured", async ({page, request}) => {
    consentFormId = await createConsentForm(request, adminToken, {
      checkboxes: [
        {label: "I agree to the privacy policy", required: true},
        {label: "I agree to receive emails", required: false},
      ],
    });

    await loginAs(page);
    await page.getByTestId("consent-form-agree-button").waitFor({state: "visible"});
    await page.getByTestId("consent-form-checkboxes").waitFor({state: "visible"});
    await expect(page.getByTestId("consent-form-checkbox-0")).toBeVisible();
    await expect(page.getByTestId("consent-form-checkbox-1")).toBeVisible();
  });
});
