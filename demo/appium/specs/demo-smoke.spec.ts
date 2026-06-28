import {$} from "@wdio/globals";

import {byTestId, openDemoComponent} from "../helpers/navigation";

describe("Demo Appium quick smoke tests", () => {
  it("opens the Button demo", async () => {
    await openDemoComponent("Button");

    const button = await $(byTestId("demo-button"));
    await expect(button).toBeDisplayed();
  });
});
