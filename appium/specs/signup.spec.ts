import {byTestId, SIGNUP_PASSWORD} from "../support/constants";

describe("Signup", () => {
  it("creates a new account", async () => {
    const uniqueEmail = `appium-${Date.now()}@example.com`;

    await browser.url("/login");
    await $(byTestId("login-screen")).waitForDisplayed({timeout: 30000});
    await $(byTestId("login-screen-signup-link")).click();

    await $(byTestId("signup-screen")).waitForDisplayed({timeout: 10000});
    await $(byTestId("signup-screen-name-input")).setValue("Appium User");
    await $(byTestId("signup-screen-email-input")).setValue(uniqueEmail);
    await $(byTestId("signup-screen-password-input")).setValue(SIGNUP_PASSWORD);
    await $(byTestId("signup-screen-submit-button")).click();

    await $(byTestId("todos-screen")).waitForDisplayed({timeout: 15000});
    await expect($(byTestId("todos-screen"))).toBeDisplayed();
  });
});
