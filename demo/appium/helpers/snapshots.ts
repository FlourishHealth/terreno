import {mkdir} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

// Story snapshots live alongside the specs (not in the gitignored logs/ folder)
// so they can be committed and diffed: a changed PNG in a pull request is the
// signal that a component's rendering changed. Baselines are device-specific, so
// regenerate them on the same platform/emulator before comparing.
const helpersDir = dirname(fileURLToPath(import.meta.url));
const snapshotsDir = join(helpersDir, "..", "screenshots");

const toPlatformLabel = (): string => (driver.isAndroid ? "android" : "ios");

interface CaptureStorySnapshotOptions {
  // The element to capture. Capturing the story root rather than the full screen
  // keeps the volatile status bar (clock, battery) out of the image.
  element: ChainablePromiseElement;
  // Stable, human-readable file name without extension, e.g. "Card-Plain".
  name: string;
}

// Saves a PNG snapshot of the given element to
// appium/screenshots/<platform>/<name>.png and returns the written path.
export const captureStorySnapshot = async ({
  element,
  name,
}: CaptureStorySnapshotOptions): Promise<string> => {
  const snapshotPath = join(snapshotsDir, toPlatformLabel(), `${name}.png`);
  await mkdir(dirname(snapshotPath), {recursive: true});

  try {
    await element.saveScreenshot(snapshotPath);
  } catch (error) {
    // Element screenshots can fail when the node is larger than the viewport;
    // fall back to a full-screen capture so a snapshot is always produced.
    console.warn(`Element snapshot failed for "${name}"; capturing full screen instead`, error);
    await driver.saveScreenshot(snapshotPath);
  }

  console.info(`Saved story snapshot: ${snapshotPath}`);
  return snapshotPath;
};
