import type {Page} from "@playwright/test";
import {TEST_USER} from "../fixtures/testUsers";

export const loginAs = async (page: Page, user = TEST_USER): Promise<void> => {
  await page.goto("/login");
  await page.getByTestId("login-screen").waitFor({state: "visible"});
  await page.getByTestId("login-screen-email-input").fill(user.email);
  await page.getByTestId("login-screen-password-input").fill(user.password);
  await page.getByTestId("login-screen-submit-button").click();
  await page.getByTestId("login-screen").first().waitFor({state: "hidden"});
};
