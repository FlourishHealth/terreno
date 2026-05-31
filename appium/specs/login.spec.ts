import {byTestId, TEST_USER} from "../support/constants";

describe("Login", () => {
  it("logs in with seeded test user", async () => {
    await browser.url("/login");
    await $(byTestId("login-screen")).waitForDisplayed({timeout: 30000});

    await $(byTestId("login-screen-email-input")).setValue(TEST_USER.email);
    await $(byTestId("login-screen-password-input")).setValue(TEST_USER.password);
    await $(byTestId("login-screen-submit-button")).click();

    await $(byTestId("todos-screen")).waitForDisplayed({timeout: 15000});
    await expect($(byTestId("todos-screen"))).toBeDisplayed();
  });
});
