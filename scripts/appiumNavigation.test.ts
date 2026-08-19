import {describe, it} from "bun:test";
import {assert} from "chai";

import {
  createPeriodicRetry,
  isAndroidDevMenuPageSource,
} from "../demo/appium/helpers/navigation";

describe("createPeriodicRetry", () => {
  it("reissues an action only after the retry interval elapses", async () => {
    let currentTime = 1000;
    let actionCount = 0;
    const retry = createPeriodicRetry({
      issueAction: async (): Promise<void> => {
        actionCount += 1;
      },
      now: (): number => currentTime,
      retryIntervalMs: 4000,
    });

    await retry();
    assert.equal(actionCount, 0);

    currentTime = 4999;
    await retry();
    assert.equal(actionCount, 0);

    currentTime = 5000;
    await retry();
    assert.equal(actionCount, 1);

    currentTime = 9000;
    await retry();
    assert.equal(actionCount, 2);
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
