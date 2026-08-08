import {$} from "@wdio/globals";

import {openDemoComponent} from "../helpers/navigation";

describe("Demo Appium smoke tests", () => {
  it("opens the Button demo and accepts clicks", async () => {
    await openDemoComponent("Button");

    const button = await $("~demo-button");
    await expect(button).toBeDisplayed();
    await button.click();
  });

  it("opens the TextField demo and accepts input", async () => {
    await openDemoComponent("Text field");

    const field = await $("~demo-text-field");
    await expect(field).toBeDisplayed();
    await field.setValue("hello appium");
    await expect(field).toHaveText("hello appium");
  });
});
