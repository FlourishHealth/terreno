import {expect, test} from "@playwright/test";
import {loginAs} from "./helpers/login";
import {mockGptStream, unmockGptStream} from "./helpers/mockGpt";

test.describe("AI Chat", () => {
  test.beforeEach(async ({page}) => {
    await loginAs(page);
    await page.goto("/ai");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("gpt-input").waitFor({state: "visible"});
  });

  test.afterEach(async ({page}) => {
    await unmockGptStream(page);
  });

  test("AI chat screen renders", async ({page}) => {
    await expect(page.getByTestId("chat")).toBeVisible();
    await expect(page.getByTestId("gpt-input")).toBeVisible();
    await expect(page.getByTestId("gpt-submit")).toBeVisible();
    await expect(page.getByTestId("gpt-new-chat-button")).toBeVisible();
  });

  test("can type and submit a message", async ({page}) => {
    await mockGptStream(page, "Hello! I am a mock AI assistant.");

    await page.getByTestId("gpt-input").fill("Say hello");
    await page.getByTestId("gpt-submit").click();

    // Wait for the streamed response text to appear
    await page.getByText("Hello! I am a mock AI assistant.").waitFor({state: "visible"});
    await expect(page.getByText("Hello! I am a mock AI assistant.")).toBeVisible();
  });

  test("shows API key input when button clicked", async ({page}) => {
    await page.getByTestId("gpt-api-key-button").click();
    await page.getByTestId("gpt-api-key-input").waitFor({state: "visible"});
    await expect(page.getByTestId("gpt-api-key-input")).toBeVisible();
  });

  test("can start a new chat", async ({page}) => {
    await mockGptStream(page, "First response");

    // Send a message to start a conversation
    await page.getByTestId("gpt-input").fill("First message");
    await page.getByTestId("gpt-submit").click();
    await page.getByText("First response").waitFor({state: "visible"});

    // Click new chat button
    await page.getByTestId("gpt-new-chat-button").click();

    // The response text from the previous conversation should be gone
    await expect(page.getByText("First response")).not.toBeVisible();
  });

  test("conversation appears in sidebar after sending", async ({page}) => {
    const chatTitle = `E2E Chat ${Date.now()}`;
    await mockGptStream(page, "Sidebar test response", {title: chatTitle});

    await page.getByTestId("gpt-input").fill("Test sidebar");
    await page.getByTestId("gpt-submit").click();
    await page.getByText("Sidebar test response").waitFor({state: "visible"});

    // The history entry should appear in the sidebar with the title
    await page.getByText(chatTitle).waitFor({state: "visible"});
    await expect(page.getByText(chatTitle)).toBeVisible();
  });

  test("can rate a message", async ({page}) => {
    await mockGptStream(page, "Rate this message please.");

    await page.getByTestId("gpt-input").fill("Give me something to rate");
    await page.getByTestId("gpt-submit").click();
    await page.getByText("Rate this message please.").waitFor({state: "visible"});

    // The rating buttons should be visible for the assistant message
    // Message index 0 is the user message, index 1 is the assistant message
    const rateUpButton = page.getByTestId("gpt-rate-up-1");
    await rateUpButton.waitFor({state: "visible"});
    await rateUpButton.click();

    // The button should still be visible after clicking (visual feedback)
    await expect(rateUpButton).toBeVisible();
  });
});
