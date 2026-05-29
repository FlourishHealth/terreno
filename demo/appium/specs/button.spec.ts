import {$} from "@wdio/globals";

import {openDemoComponent} from "../helpers/navigation";

describe("Button demo", () => {
  it("renders the primary demo button and accepts clicks", async () => {
    await openDemoComponent("Button");

    const button = await $("~demo-button");
    await expect(button).toBeDisplayed();
    await button.click();
  });
});
