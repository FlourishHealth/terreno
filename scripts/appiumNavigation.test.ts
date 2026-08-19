import {describe, it} from "bun:test";
import {assert} from "chai";

import {
  createIosLoadTimeoutRecovery,
  isAndroidDevMenuPageSource,
  isIosDevClientLoadTimeoutPageSource,
} from "../demo/appium/helpers/navigation";

describe("iOS dev-client load-timeout recovery", () => {
  const timeoutPageSource = `
    <XCUIElementTypeStaticText value="There was a problem loading the project." />
    <XCUIElementTypeStaticText value="Failed to load app from http://localhost:8085 with error: The request timed out." />
    <XCUIElementTypeButton name="Reload" label="Reload" />
  `;

  it("detects the Expo iOS load-timeout overlay", () => {
    assert.isTrue(isIosDevClientLoadTimeoutPageSource(timeoutPageSource));
    assert.isFalse(
      isIosDevClientLoadTimeoutPageSource(`
        <XCUIElementTypeStaticText value="Terreno Demo" />
        <XCUIElementTypeButton name="Reload" label="Reload" />
      `)
    );
  });

  it("reloads the timed-out iOS project once", async () => {
    let reloadCount = 0;
    const recover = createIosLoadTimeoutRecovery({
      isIos: true,
      reload: async (): Promise<void> => {
        reloadCount += 1;
      },
    });

    assert.isTrue(await recover(timeoutPageSource));
    assert.isFalse(await recover(timeoutPageSource));
    assert.equal(reloadCount, 1);
  });
});

describe("isAndroidDevMenuPageSource", () => {
  it("detects the Expo SDK 56 development menu", () => {
    const pageSource = `
      <android.widget.TextView text="Reload" />
      <android.widget.TextView text="Go home" />
      <android.widget.TextView text="Open React Native dev menu" />
    `;

    assert.isTrue(isAndroidDevMenuPageSource(pageSource));
  });

  it("detects the legacy development menu", () => {
    const pageSource = `
      <android.widget.TextView text="Connected to: Metro" />
      <android.widget.TextView text="Toggle dev menu" />
    `;

    assert.isTrue(isAndroidDevMenuPageSource(pageSource));
  });

  it("does not classify the rendered demo as a development menu", () => {
    const pageSource = `
      <android.widget.TextView text="Terreno Demo" />
      <android.widget.TextView text="Button" />
    `;

    assert.isFalse(isAndroidDevMenuPageSource(pageSource));
  });
});
