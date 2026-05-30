const DEMO_COMPONENT_TEST_IDS: Record<string, string> = {
  Button: "demo-button",
  "Text field": "demo-text-field",
};

const tapComponentOnDemoHome = async (componentName: string): Promise<void> => {
  if (driver.isAndroid) {
    const selector = `new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("${componentName}"))`;
    const item = await $(`android=${selector}`);
    await item.waitForDisplayed({timeout: 30000});
    await item.click();
    return;
  }

  const predicate = `-ios predicate string:label == "${componentName}"`;
  const item = await $(predicate);

  try {
    await item.waitForDisplayed({timeout: 5000});
  } catch {
    await driver.execute("mobile: scroll", {
      direction: "down",
      predicateString: `label == "${componentName}"`,
    });
    await item.waitForDisplayed({timeout: 30000});
  }

  await item.click();
};

export const openDemoComponent = async (componentName: string): Promise<void> => {
  const testId = DEMO_COMPONENT_TEST_IDS[componentName];
  if (!testId) {
    throw new Error(`No testID mapping for demo component: ${componentName}`);
  }

  await tapComponentOnDemoHome(componentName);

  const element = await $(`~${testId}`);
  await element.waitForDisplayed({timeout: 30000});
};
