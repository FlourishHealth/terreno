import type {Options} from "@wdio/types";
import {sharedConfig} from "./wdio.shared";

export const config: Options.Testrunner = {
  ...sharedConfig,
};
