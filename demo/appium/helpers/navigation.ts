import {DEMO_APP_BUNDLE_ID, DEMO_APP_PACKAGE, DEMO_DEEP_LINK_SCHEME} from "../constants";

const DEMO_COMPONENT_TEST_IDS: Record<string, string> = {
  Button: "demo-button",
  "Text field": "demo-text-field",
};

const toDemoHomeTestId = (componentName: string): string =>
  `demo-home-${componentName.toLowerCase().replace(/\s+/g, "-")}`;

const toDemoDeepLink = (componentName: string): string =>
  `${DEMO_DEEP_LINK_SCHEME}:///demo/${encodeURIComponent(componentName)}`;

const waitForAppForeground = async (): Promise<void> => {
  await driver.waitUntil(
    async () => {
      const appId = driver.isAndroid ? DEMO_APP_PACKAGE : DEMO_APP_BUNDLE_ID;
      const state = await driver.queryAppState(appId);
      return state >= 3;
    },
    {
      interval: 1000,
      timeout: 60000,
      timeoutMsg: "Demo app did not reach foreground state",
    }
  );
};

const openDemoDeepLink = async (componentName: string): Promise<void> => {
  const url = toDemoDeepLink(componentName);
  console.info(`Opening demo deep link: ${url}`);

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
  const homeTestId = toDemoHomeTestId(componentName);
  let item = await $(`~${homeTestId}`);

  try {
    await item.waitForDisplayed({timeout: 10000});
  } catch {
    if (driver.isAndroid) {
      item = await $(`android=new UiSelector().description("${componentName}")`);
    }

    try {
      await item.waitForDisplayed({timeout: 10000});
    } catch {
      await scrollDemoHome(componentName);
      await item.waitForDisplayed({timeout: 30000});
    }
  }

  await item.click();
};

export const openDemoComponent = async (componentName: string): Promise<void> => {
  const testId = DEMO_COMPONENT_TEST_IDS[componentName];
  if (!testId) {
    throw new Error(`No testID mapping for demo component: ${componentName}`);
  }

  await waitForAppForeground();

  const target = await $(`~${testId}`);

  try {
    await openDemoDeepLink(componentName);
    await target.waitForDisplayed({timeout: 60000});
    return;
  } catch (error) {
    console.warn(`Deep link navigation failed for ${componentName}; falling back to demo home`, error);
    await tapComponentOnDemoHome(componentName);
    await target.waitForDisplayed({timeout: 60000});
  }
};
