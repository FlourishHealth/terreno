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
  stage: "deep-link-navigation" | "dev-launcher-bootstrap" | "fallback-navigation" | "preflight";
}

const DEV_LAUNCHER_MARKERS = [
  "development servers",
  "dev launcher",
  "expo-development-client",
  "open from clipboard",
];

const isQuickLoop = process.env.APPIUM_QUICK_LOOP === "true";
const isCi = process.env.CI === "true";
const appiumDevServerUrl = process.env.APPIUM_DEV_SERVER_URL?.trim();
const shouldRequireNonDevClient = process.env.APPIUM_REQUIRE_NON_DEV_CLIENT === "true";
const appiumLogsDir = join(process.cwd(), "logs");
const appForegroundTimeoutMs = isQuickLoop ? 30000 : 60000;
const deepLinkTargetTimeoutMs = isQuickLoop ? 30000 : 60000;
const fallbackTargetTimeoutMs = isQuickLoop ? 30000 : 60000;
const homeScreenTimeoutMs = isQuickLoop ? 45000 : 120000;
const homeItemTimeoutMs = isQuickLoop ? 15000 : 30000;
const itemInitialTimeoutMs = isQuickLoop ? 6000 : 10000;
const itemPostScrollTimeoutMs = isQuickLoop ? 15000 : 30000;
const overlayDismissTimeoutMs = isQuickLoop ? 15000 : 30000;

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
  if (!shouldRequireNonDevClient) {
    return;
  }

  if (!isCi && !isQuickLoop) {
    return;
  }

  const isDevLauncher = await isDevLauncherVisible();
  if (!isDevLauncher) {
    return;
  }

  const error = new Error(
    "Detected Expo Dev Launcher instead of demo app UI while APPIUM_REQUIRE_NON_DEV_CLIENT=true. Use a non-development-client profile or unset APPIUM_REQUIRE_NON_DEV_CLIENT."
  );
  await captureNavigationDiagnostics({
    componentName,
    error,
    stage: "preflight",
  });
  throw error;
};

const waitForDemoHomeReady = async (): Promise<void> => {
  try {
    await waitForSelectorDisplayedWithRecovery("~demo-home-screen", {
      timeout: homeScreenTimeoutMs,
      timeoutMsg: "Demo home screen did not render",
    });
    return;
  } catch {
    // ScrollView testIDs are unreliable on Android; fall back to a home list item.
    await waitForSelectorDisplayedWithRecovery("~demo-home-button", {
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

const buildDevClientComponentUrl = (): string => {
  if (!appiumDevServerUrl || appiumDevServerUrl.length === 0) {
    throw new Error(
      "APPIUM_DEV_SERVER_URL must be set when running against a development client build (for example: http://127.0.0.1:8085)."
    );
  }

  const projectUrl = appiumDevServerUrl.replace(/\/+$/, "");
  return `${DEMO_DEEP_LINK_SCHEME}://expo-development-client/?url=${encodeURIComponent(projectUrl)}`;
};

const openDevClientComponentUrl = async (): Promise<void> => {
  const url = buildDevClientComponentUrl();
  console.info(`Opening dev-client URL: ${url}`);

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

const getDevServerOriginLabel = (): string => {
  if (!appiumDevServerUrl || appiumDevServerUrl.length === 0) {
    throw new Error(
      "APPIUM_DEV_SERVER_URL must be set when running against a development client build."
    );
  }

  const normalizedUrl = appiumDevServerUrl.replace(/\/+$/, "");
  const parsedUrl = new URL(normalizedUrl);
  const hostname = parsedUrl.hostname === "127.0.0.1" ? "localhost" : parsedUrl.hostname;
  const portSuffix = parsedUrl.port.length > 0 ? `:${parsedUrl.port}` : "";
  return `${parsedUrl.protocol}//${hostname}${portSuffix}`;
};

const selectDevServerFromIosLauncher = async (): Promise<boolean> => {
  if (!driver.isIOS) {
    return false;
  }

  const serverLabel = getDevServerOriginLabel();
  const serverButton = await $(`~${serverLabel}`);
  const isVisible = await serverButton
    .isDisplayed()
    .then((value) => value)
    .catch(() => false);
  if (!isVisible) {
    return false;
  }

  console.info(`Selecting iOS dev server entry: ${serverLabel}`);
  await serverButton.click();
  return true;
};

const ensureDevClientAppLoaded = async (componentName: string): Promise<void> => {
  const isLauncherVisible = await isDevLauncherVisible();
  if (!isLauncherVisible) {
    return;
  }

  try {
    const didSelectServer = await selectDevServerFromIosLauncher();
    if (!didSelectServer) {
      await openDevClientComponentUrl();
    }
    await driver.waitUntil(
      async () => {
        return !(await isDevLauncherVisible());
      },
      {
        interval: 1000,
        timeout: isQuickLoop ? 45000 : 90000,
        timeoutMsg: "Dev Launcher remained visible after opening APPIUM_DEV_SERVER_URL",
      }
    );
  } catch (error) {
    await captureNavigationDiagnostics({
      componentName,
      error,
      stage: "dev-launcher-bootstrap",
    });
    throw error;
  }
};

const tapIfDisplayed = async (selector: string): Promise<boolean> => {
  const element = await $(selector);
  const isVisible = await element
    .isDisplayed()
    .then((value) => value)
    .catch(() => false);
  if (!isVisible) {
    return false;
  }

  await element.click();
  return true;
};

const waitForSelectorDisplayedWithRecovery = async (
  selector: string,
  options: {timeout: number; timeoutMsg: string}
): Promise<void> => {
  await driver.waitUntil(
    async () => {
      await dismissDevMenuOverlay();
      const element = await $(selector);
      return element
        .isDisplayed()
        .then((value) => value)
        .catch(() => false);
    },
    {
      interval: 1000,
      timeout: options.timeout,
      timeoutMsg: options.timeoutMsg,
    }
  );
};

const tryTapSelectors = async (selectors: string[]): Promise<boolean> => {
  for (const selector of selectors) {
    if (await tapIfDisplayed(selector)) {
      return true;
    }
  }

  return false;
};

const isAndroidDevMenuPanelVisible = async (): Promise<boolean> => {
  if (!driver.isAndroid) {
    return false;
  }

  try {
    const pageSource = (await driver.getPageSource()).toLowerCase();
    return pageSource.includes("connected to:") && pageSource.includes("toggle dev menu");
  } catch {
    return false;
  }
};

const dismissDevMenuOverlay = async (): Promise<void> => {
  const dismissUntil = Date.now() + overlayDismissTimeoutMs;
  while (Date.now() < dismissUntil) {
    const isAndroidDevMenuVisible = await isAndroidDevMenuPanelVisible();
    const didTapContinue = driver.isAndroid
      ? await tryTapSelectors([
          'android=new UiSelector().text("Continue")',
          '//android.widget.TextView[@text="Continue"]/ancestor::android.view.View[@clickable="true"][1]',
          '//android.widget.TextView[@text="Continue"]',
          "~Continue",
        ])
      : await tapIfDisplayed("~Continue");
    const didTapAndroidPanelAction =
      driver.isAndroid && isAndroidDevMenuVisible
        ? await tryTapSelectors([
            'android=new UiSelector().text("Go home")',
            '//android.widget.TextView[@text="Go home"]/ancestor::android.view.View[@clickable="true"][1]',
            'android=new UiSelector().description("Home")',
            'android=new UiSelector().text("Reload")',
          ])
        : false;
    const didTapClose = (await tapIfDisplayed("~Close")) || (await tapIfDisplayed("~xmark"));
    if (!didTapContinue && !didTapClose && !didTapAndroidPanelAction) {
      if (isAndroidDevMenuVisible) {
        await driver.back();
        await driver.pause(500);
        continue;
      }
      return;
    }

    await driver.pause(500);
  }
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
  await ensureDevClientAppLoaded(componentName);
  await ensureNotInDevLauncher(componentName);
  await dismissDevMenuOverlay();
  const targetSelector = `~${testId}`;

  // Deep links work from any screen; prefer them over requiring the home list to render.
  try {
    await openDemoDeepLink(componentName);
    await waitForSelectorDisplayedWithRecovery(targetSelector, {
      timeout: deepLinkTargetTimeoutMs,
      timeoutMsg: `Element "~${testId}" did not display after deep-link navigation`,
    });
    return;
  } catch (error) {
    await captureNavigationDiagnostics({
      componentName,
      error,
      stage: "deep-link-navigation",
    });
    console.warn(`Deep link navigation failed for ${componentName}; falling back to demo home`, error);
    await dismissDevMenuOverlay();
  }

  try {
    await waitForDemoHomeReady();
    await tapComponentOnDemoHome(componentName);
    await waitForSelectorDisplayedWithRecovery(targetSelector, {
      timeout: fallbackTargetTimeoutMs,
      timeoutMsg: `Element "~${testId}" did not display after fallback navigation`,
    });
  } catch (error) {
    await captureNavigationDiagnostics({
      componentName,
      error,
      stage: "fallback-navigation",
    });
    throw error;
  }
};
