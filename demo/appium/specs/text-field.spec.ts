import {$} from "@wdio/globals";

describe("TextField demo", () => {
  it("renders the demo text field and accepts input", async () => {
    await browser.url("/demo/Text%20field");

    const heading = await $("h1*=Text field");
    await expect(heading).toBeDisplayed();

    const field = await $('[data-testid="demo-text-field"]');
    await expect(field).toBeDisplayed();
    await field.setValue("hello appium");
    await expect(field).toHaveValue("hello appium");
  });
});
