import {describe, test} from "bun:test";
import {existsSync} from "node:fs";
import {join} from "node:path";
import {assert} from "chai";

const REPO_ROOT = join(import.meta.dir, "../..");

const DEAD_EXAMPLE_FRONTEND_FILES = [
  "example-frontend/constants/Colors.ts",
  "example-frontend/hooks/useLogoutUser.ts",
  "example-frontend/hooks/useSentryUserSetup.ts",
  "example-frontend/hooks/useUpdateProfile.ts",
] as const;

describe("file hygiene", (): void => {
  test("does not retain dead example-frontend modules", (): void => {
    for (const file of DEAD_EXAMPLE_FRONTEND_FILES) {
      assert.isFalse(existsSync(join(REPO_ROOT, file)), file);
    }
  });
});
