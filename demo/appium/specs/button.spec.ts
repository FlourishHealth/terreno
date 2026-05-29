import {$} from "@wdio/globals";

describe("Button demo", () => {
  it("renders the primary demo button and accepts clicks", async () => {
    await browser.url("/demo/Button");

    const heading = await $("h1*=Button");
    await expect(heading).toBeDisplayed();

    const button = await $('[data-testid="demo-button"]');
    await expect(button).toBeDisplayed();
    await expect(button).toHaveText("Button");
    await button.click();
  });
});
