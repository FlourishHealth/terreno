import type {Options} from "@wdio/types";
import {saveProofScreenshot} from "./support/screenshot";
import {sharedConfig} from "./wdio.shared";

export const config: Options.Testrunner = {
  ...sharedConfig,
  afterTest: async (_test, _context, {passed}) => {
    const label = passed ? "pass" : "fail";
    await saveProofScreenshot(`${_test.parent}-${_test.title}-${label}`);
  },
};
