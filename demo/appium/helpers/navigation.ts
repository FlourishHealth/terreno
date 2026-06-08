import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";

import {DateTime} from "luxon";

import {DEMO_APP_BUNDLE_ID, DEMO_APP_PACKAGE, DEMO_DEEP_LINK_SCHEME} from "../constants";

const DEMO_COMPONENT_TEST_IDS: Record<string, string> = {
  Button: "demo-button",
  "Text field": "demo-text-field",
};

interface NavigationDiagnosticsOptions {
  componentName: string;
  error?: unknown;
  stage: "deep-link-navigation" | "fallback-navigation" | "preflight";
}

const DEV_LAUNCHER_MARKERS = [
  "development servers",
  "dev launcher",
  "expo-development-client",
  "open from clipboard",
];

const isQuickLoop = process.env.APPIUM_QUICK_LOOP === "true";
const isCi = process.env.CI === "true";
const appiumLogsDir = join(process.cwd(), "logs");
const appForegroundTimeoutMs = isQuickLoop ? 30000 : 60000;
const deepLinkTargetTimeoutMs = isQuickLoop ? 30000 : 60000;
const fallbackTargetTimeoutMs = isQuickLoop ? 30000 : 60000;
const homeScreenTimeoutMs = isQuickLoop ? 45000 : 120000;
const homeItemTimeoutMs = isQuickLoop ? 15000 : 30000;
const itemInitialTimeoutMs = isQuickLoop ? 6000 : 10000;
const itemPostScrollTimeoutMs = isQuickLoop ? 15000 : 30000;

const toDemoHomeTestId = (componentName: string): string =>
  `demo-home-${componentName.toLowerCase().replace(/\s+/g, "-")}`;

const toDemoDeepLink = (componentName: string): string =>
  `${DEMO_DEEP_LINK_SCHEME}:///demo/${encodeURIComponent(componentName)}`;

const toSafeLogSegment = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const toErrorDetails = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
};

const getAppIdentifier = (): string => {
  if (driver.isAndroid) {
    return DEMO_APP_PACKAGE;
  }
  return DEMO_APP_BUNDLE_ID;
};

const ensureAppiumLogsDirectory = async (): Promise<void> => {
  await mkdir(appiumLogsDir, {recursive: true});
};

const captureNavigationDiagnostics = async (
  options: NavigationDiagnosticsOptions
): Promise<void> => {
  const timestamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss-SSS");
  const baseName = `${timestamp}-${toSafeLogSegment(options.componentName)}-${toSafeLogSegment(options.stage)}`;
  const diagnosticsPath = join(appiumLogsDir, `appium-diagnostics-${baseName}.txt`);
  const pageSourcePath = join(appiumLogsDir, `appium-page-source-${baseName}.xml`);
  const screenshotPath = join(appiumLogsDir, `appium-screenshot-${baseName}.png`);
  const details: string[] = [];

  try {
    await ensureAppiumLogsDirectory();
    details.push(`timestampUtc=${DateTime.utc().toISO() ?? "unknown"}`);
    details.push(`platform=${driver.isAndroid ? "android" : "ios"}`);
    details.push(`componentName=${options.componentName}`);
    details.push(`stage=${options.stage}`);
    details.push(`quickLoop=${isQuickLoop}`);
    if (options.error) {
      details.push(`navigationError=${toErrorDetails(options.error)}`);
    }

    try {
      const appState = await driver.queryAppState(getAppIdentifier());
      details.push(`appState=${String(appState)}`);
    } catch (error) {
      details.push(`appState=<error>${toErrorDetails(error)}</error>`);
    }

    if (driver.isAndroid) {
      try {
        const currentActivity = await driver.getCurrentActivity();
        details.push(`currentActivity=${currentActivity}`);
      } catch (error) {
        details.push(`currentActivity=<error>${toErrorDetails(error)}</error>`);
      }
    }

    try {
      const contexts = await driver.getContexts();
      details.push(`contexts=${JSON.stringify(contexts)}`);
    } catch (error) {
      details.push(`contexts=<error>${toErrorDetails(error)}</error>`);
    }

    await writeFile(diagnosticsPath, `${details.join("\n")}\n`, "utf8");
    console.info(`Saved Appium diagnostics: ${diagnosticsPath}`);
  } catch (error) {
    console.warn("Failed to write Appium diagnostics details", error);
  }

  try {
    const pageSource = await driver.getPageSource();
    await writeFile(pageSourcePath, pageSource, "utf8");
    console.info(`Saved Appium page source: ${pageSourcePath}`);
  } catch (error) {
    console.warn("Failed to capture Appium page source", error);
  }

  try {
    await driver.saveScreenshot(screenshotPath);
    console.info(`Saved Appium screenshot: ${screenshotPath}`);
  } catch (error) {
    console.warn("Failed to capture Appium screenshot", error);
  }
};

const waitForAppForeground = async (): Promise<void> => {
  await driver.waitUntil(
    async () => {
      const state = await driver.queryAppState(getAppIdentifier());
      return state >= 3;
    },
    {
      interval: 1000,
      timeout: appForegroundTimeoutMs,
      timeoutMsg: "Demo app did not reach foreground state",
    }
  );
};

const isDevLauncherVisible = async (): Promise<boolean> => {
  if (driver.isAndroid) {
    try {
      const currentActivity = await driver.getCurrentActivity();
      if (currentActivity.toLowerCase().includes("devlauncher")) {
        return true;
      }
    } catch {
      // Ignore activity lookup failures and continue with page source checks.
    }
  }

  try {
    const pageSource = (await driver.getPageSource()).toLowerCase();
    return DEV_LAUNCHER_MARKERS.some((marker) => pageSource.includes(marker));
  } catch {
    return false;
  }
};

const ensureNotInDevLauncher = async (componentName: string): Promise<void> => {
  if (!isCi && !isQuickLoop) {
    return;
  }

  const isDevLauncher = await isDevLauncherVisible();
  if (!isDevLauncher) {
    return;
  }

  const error = new Error(
    'Detected Expo Dev Launcher instead of demo app UI. Configure APPIUM_*_EAS_PROFILE to a non-development-client profile (for example "preview").'
  );
  await captureNavigationDiagnostics({
    componentName,
    error,
    stage: "preflight",
  });
  throw error;
};

const waitForDemoHomeReady = async (): Promise<void> => {
  const homeScreen = await $("~demo-home-screen");

  try {
    await homeScreen.waitForExist({
      interval: 1000,
      timeout: homeScreenTimeoutMs,
      timeoutMsg: "Demo home screen did not render",
    });
    return;
  } catch {
    // ScrollView testIDs are unreliable on Android; fall back to a home list item.
    const homeItem = await $("~demo-home-button");
    await homeItem.waitForDisplayed({
      interval: 1000,
      timeout: homeItemTimeoutMs,
      timeoutMsg: "Demo home screen did not render",
    });
  }
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
    await item.waitForDisplayed({timeout: itemInitialTimeoutMs});
  } catch {
    if (driver.isAndroid) {
      item = await $(`android=new UiSelector().description("${componentName}")`);
    }

    try {
      await item.waitForDisplayed({timeout: itemInitialTimeoutMs});
    } catch {
      await scrollDemoHome(componentName);
      await item.waitForDisplayed({timeout: itemPostScrollTimeoutMs});
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
  await ensureNotInDevLauncher(componentName);
  const target = await $(`~${testId}`);

  // Deep links work from any screen; prefer them over requiring the home list to render.
  try {
    await openDemoDeepLink(componentName);
    await target.waitForDisplayed({timeout: deepLinkTargetTimeoutMs});
    return;
  } catch (error) {
    await captureNavigationDiagnostics({
      componentName,
      error,
      stage: "deep-link-navigation",
    });
    console.warn(`Deep link navigation failed for ${componentName}; falling back to demo home`, error);
  }

  try {
    await waitForDemoHomeReady();
    await tapComponentOnDemoHome(componentName);
    await target.waitForDisplayed({timeout: fallbackTargetTimeoutMs});
  } catch (error) {
    await captureNavigationDiagnostics({
      componentName,
      error,
      stage: "fallback-navigation",
    });
    throw error;
  }
};
