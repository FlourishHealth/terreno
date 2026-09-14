import {mkdirSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {describe, it} from "bun:test";
import {assert} from "chai";

import {loadUnreleasedFragments, UNRELEASED_DIR_NAME} from "./io";

const writeUnreleasedRepo = (files: Record<string, string>): string => {
  const repoRoot = mkdtempSync(join(tmpdir(), "changelog-fragments-"));
  const directoryPath = join(repoRoot, UNRELEASED_DIR_NAME);
  mkdirSync(directoryPath, {recursive: true});

  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(directoryPath, fileName), content);
  }

  return repoRoot;
};

describe("loadUnreleasedFragments", () => {
  it("fails on misnamed markdown instead of skipping it", (): void => {
    const repoRoot = writeUnreleasedRepo({
      "README.md": "# Unreleased changelog fragments\n",
      "SendGrid.md": "---\ncategory: Added\n---\n\nSendGrid provider\n",
      "valid-note.md": "---\ncategory: Fixed\n---\n\nA real fix\n",
    });

    const {failures, fragments} = loadUnreleasedFragments(repoRoot);

    assert.equal(fragments.length, 1);
    assert.equal(fragments[0]?.fileName, "valid-note.md");
    assert.equal(failures.length, 1);
    assert.equal(failures[0]?.fileName, "SendGrid.md");
    assert.match(failures[0]?.message ?? "", /kebab-case/);
  });
});
