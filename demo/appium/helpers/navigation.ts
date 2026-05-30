import {DEMO_APP_BUNDLE_ID, DEMO_APP_PACKAGE, DEMO_DEEP_LINK_SCHEME} from "../constants";

const DEMO_COMPONENT_TEST_IDS: Record<string, string> = {
  Button: "demo-button",
  "Text field": "demo-text-field",
};

const toDemoHomeTestId = (componentName: string): string =>
  `demo-home-${componentName.toLowerCase().replace(/\s+/g, "-")}`;

const openDemoDeepLink = async (componentName: string): Promise<void> => {
  const url = `${DEMO_DEEP_LINK_SCHEME}://demo/${encodeURIComponent(componentName)}`;

  if (driver.isAndroid) {
    await driver.execute("mobile: deepLink", {
      url,
      package: DEMO_APP_PACKAGE,
    });
    return;
  }

  await driver.execute("mobile: deepLink", {
    url,
    bundleId: DEMO_APP_BUNDLE_ID,
  });
};

const scrollDemoHome = async (componentName: string): Promise<void> => {
  if (driver.isAndroid) {
    await driver.execute("mobile: scrollGesture", {
      left: 100,
      top: 300,
      width: 600,
      height: 900,
      direction: "down",
      percent: 0.75,
    });
    return;
  }

  await driver.execute("mobile: scroll", {
    direction: "down",
    predicateString: `label == "${componentName}"`,
  });
};

const tapComponentOnDemoHome = async (componentName: string): Promise<void> => {
  const item = await $(`~${toDemoHomeTestId(componentName)}`);

  try {
    await item.waitForDisplayed({timeout: 10000});
  } catch {
    await scrollDemoHome(componentName);
    await item.waitForDisplayed({timeout: 30000});
  }

  await item.click();
};

export const openDemoComponent = async (componentName: string): Promise<void> => {
  const testId = DEMO_COMPONENT_TEST_IDS[componentName];
  if (!testId) {
    throw new Error(`No testID mapping for demo component: ${componentName}`);
  }

  const target = await $(`~${testId}`);

  try {
    await openDemoDeepLink(componentName);
    await target.waitForDisplayed({timeout: 60000});
    return;
  } catch {
    await tapComponentOnDemoHome(componentName);
    await target.waitForDisplayed({timeout: 60000});
  }
};
