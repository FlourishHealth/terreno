import {describe, expect, it} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {Glob} from "bun";

// react-native-web drops shadowColor / shadowOffset / shadowOpacity / shadowRadius
// and warns once per app: '"shadow*" style props are deprecated. Use "boxShadow".'
// Use `boxShadow` (see `createBoxShadow` in Utilities) instead, plus `elevation`
// for Android's legacy renderer.
const DEPRECATED_SHADOW_PROPS = /\bshadow(Color|Offset|Opacity|Radius)\b/;

describe("deprecated shadow style props", () => {
  it("are not used anywhere in @terreno/ui source", () => {
    const sourceRoot = join(import.meta.dir);
    const glob = new Glob("**/*.{ts,tsx}");
    const offenders: string[] = [];

    for (const relativePath of glob.scanSync({cwd: sourceRoot, onlyFiles: true})) {
      if (relativePath.endsWith(".test.ts") || relativePath.endsWith(".test.tsx")) {
        continue;
      }
      const contents = readFileSync(join(sourceRoot, relativePath), "utf8");
      if (DEPRECATED_SHADOW_PROPS.test(contents)) {
        offenders.push(relativePath);
      }
    }

    expect(offenders).toEqual([]);
  });
});
