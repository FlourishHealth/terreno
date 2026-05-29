import {DEMO_APP_BUNDLE_ID, DEMO_APP_PACKAGE, DEMO_DEEP_LINK_SCHEME} from "../constants";

export const openDemoComponent = async (componentName: string): Promise<void> => {
  const encodedName = encodeURIComponent(componentName);
  const url = `${DEMO_DEEP_LINK_SCHEME}://demo/${encodedName}`;

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
