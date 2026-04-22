import {copyFileSync, existsSync, mkdirSync} from "node:fs";
import {dirname, join} from "node:path";

// Copy the test fixture TypeDoc JSON into src/docs/ so buildResources()
// exercises the component documentation code paths during tests. The target
// path is gitignored, so leaving it in place between runs is harmless.
const fixturePath = join(import.meta.dir, "fixtures", "docs", "ui-types-documentation.json");
const targetPath = join(import.meta.dir, "..", "docs", "ui-types-documentation.json");

if (existsSync(fixturePath)) {
  mkdirSync(dirname(targetPath), {recursive: true});
  copyFileSync(fixturePath, targetPath);
}
