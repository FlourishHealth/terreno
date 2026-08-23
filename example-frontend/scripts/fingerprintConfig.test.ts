import {describe, it} from "bun:test";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {assert} from "chai";

interface FingerprintConfig {
  sourceSkips: string[];
}

const require = createRequire(import.meta.url);
const repositoryRoot = resolve(import.meta.dir, "../..");
const appDirectories = ["demo", "example-frontend"];
const expectedSourceSkips = ["ExpoConfigExtraSection", "PackageJsonScriptsAll"];

describe("Expo fingerprint configuration", (): void => {
  for (const appDirectory of appDirectories) {
    it(`${appDirectory} excludes JavaScript-only sources`, (): void => {
      const configPath = resolve(repositoryRoot, appDirectory, "fingerprint.config.js");
      const config = require(configPath) as FingerprintConfig;

      assert.sameMembers(config.sourceSkips, expectedSourceSkips);
    });
  }
});
