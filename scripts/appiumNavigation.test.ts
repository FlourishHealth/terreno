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

  it("retries reload if the first click fails", async () => {
    let reloadCount = 0;
    const recover = createIosLoadTimeoutRecovery({
      isIos: true,
      reload: async (): Promise<void> => {
        reloadCount += 1;
        if (reloadCount === 1) {
          throw new Error("click failed");
        }
      },
    });

    assert.isFalse(await recover(timeoutPageSource));
    assert.isTrue(await recover(timeoutPageSource));
    assert.isFalse(await recover(timeoutPageSource));
    assert.equal(reloadCount, 2);
  });

  it("does not treat the load-timeout overlay as a loaded app", () => {
    assert.isTrue(isIosDevClientLoadTimeoutPageSource(timeoutPageSource));
    assert.notInclude(timeoutPageSource.toLowerCase(), "development servers");
    assert.notInclude(timeoutPageSource.toLowerCase(), "dev launcher");
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
