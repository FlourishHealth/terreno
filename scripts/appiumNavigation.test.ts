import {describe, it} from "bun:test";
import {assert} from "chai";

import {isAndroidDevMenuPageSource} from "../demo/appium/helpers/navigation";

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
