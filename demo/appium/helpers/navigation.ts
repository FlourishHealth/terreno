import {DEMO_APP_BUNDLE_ID, DEMO_APP_PACKAGE, DEMO_DEEP_LINK_SCHEME} from "../constants";

const DEMO_COMPONENT_TEST_IDS: Record<string, string> = {
  Button: "demo-button",
  "Text field": "demo-text-field",
};

export const openDemoComponent = async (componentName: string): Promise<void> => {
  const encodedName = encodeURIComponent(componentName);
  // Expo Router expects the path in the URI path, not the host (terreno:///demo/...).
  const url = `${DEMO_DEEP_LINK_SCHEME}:///demo/${encodedName}`;
  const testId = DEMO_COMPONENT_TEST_IDS[componentName];

  if (driver.isAndroid) {
    await driver.execute("mobile: deepLink", {
      url,
      package: DEMO_APP_PACKAGE,
    });
  } else {
    await driver.execute("mobile: deepLink", {
      url,
      bundleId: DEMO_APP_BUNDLE_ID,
    });
  }

  if (!testId) {
    return;
  }

  const element = await $(`~${testId}`);
  await element.waitForDisplayed({timeout: 30000});
};
