import {$} from "@wdio/globals";

import {openDemoComponent} from "../helpers/navigation";

describe("TextField demo", () => {
  it("renders the demo text field and accepts input", async () => {
    await openDemoComponent("Text field");

    const field = await $("~demo-text-field");
    await expect(field).toBeDisplayed();
    await field.setValue("hello appium");
    await expect(field).toHaveText("hello appium");
  });
});
