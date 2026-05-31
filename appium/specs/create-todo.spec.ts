import {byTestId, TEST_USER} from "../support/constants";

const loginAsTestUser = async (): Promise<void> => {
  await browser.url("/login");
  await $(byTestId("login-screen")).waitForDisplayed({timeout: 30000});
  await $(byTestId("login-screen-email-input")).setValue(TEST_USER.email);
  await $(byTestId("login-screen-password-input")).setValue(TEST_USER.password);
  await $(byTestId("login-screen-submit-button")).click();
  await $(byTestId("todos-screen")).waitForDisplayed({timeout: 15000});
};

describe("Create todo", () => {
  it("logs in and creates a todo", async () => {
    await loginAsTestUser();

    const todoTitle = "Buy groceries";
    await $(byTestId("todos-new-title-input")).setValue(todoTitle);
    await $(byTestId("todos-add-button")).click();

    await $(`=${todoTitle}`).waitForDisplayed({timeout: 5000});
    await expect($(`=${todoTitle}`)).toBeDisplayed();
  });
});
