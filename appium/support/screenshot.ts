import fs from "node:fs";
import path from "node:path";

export const saveProofScreenshot = async (label: string): Promise<void> => {
  const outputDir = process.env.PROOF_OUTPUT_DIR;
  if (!outputDir) {
    return;
  }

  fs.mkdirSync(outputDir, {recursive: true});
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const filePath = path.join(outputDir, `${Date.now()}-${safeLabel}.png`);
  await browser.saveScreenshot(filePath);
};
