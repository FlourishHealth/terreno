import {$} from "@wdio/globals";

import {openDemoComponent} from "../helpers/navigation";

describe("Demo Appium quick smoke tests", () => {
  it("opens the Button demo", async () => {
    await openDemoComponent("Button");

    const button = await $("~demo-button");
    await expect(button).toBeDisplayed();
  });
});
