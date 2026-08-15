import {test} from "bun:test";
import {assert} from "chai";

import {checkUpgradeDocumentation} from "./lib";

const CHANGELOG_WITH_REQUIRED_NOTE = `# Changelog

## [1.2.0] - 2026-08-08

### Changed

- Rename a public API.

### Breaking changes

- Remove a legacy call signature.

### Deprecated

- Deprecate an old helper.

### Removed

- Remove a deprecated export.

## [1.1.0] - 2026-08-01

### Added

- Add a public API.
`;

const CHANGELOG_WITHOUT_REQUIRED_NOTE = `# Changelog

## [1.2.0] - 2026-08-08

### Added

- Add a backwards-compatible public API.

### Fixed

- Correct an implementation detail.
`;

test("passes when a required upgrade note is present", (): void => {
  const result = checkUpgradeDocumentation({
    changelog: CHANGELOG_WITH_REQUIRED_NOTE,
    hasUpgradeNote: true,
    version: "1.2.0",
  });

  assert.isTrue(result.isValid);
  assert.isTrue(result.requiresUpgradeNote);
  assert.deepEqual(result.triggeringSections, [
    "changed",
    "breaking changes",
    "deprecated",
    "removed",
  ]);
});

test("fails when a required upgrade note is missing", (): void => {
  const result = checkUpgradeDocumentation({
    changelog: CHANGELOG_WITH_REQUIRED_NOTE,
    hasUpgradeNote: false,
    version: "1.2.0",
  });

  assert.isFalse(result.isValid);
  assert.include(result.message, "mcp-server/src/docs/upgrades/1.2.0.md");
});

test("passes when an upgrade note is not required", (): void => {
  const result = checkUpgradeDocumentation({
    changelog: CHANGELOG_WITHOUT_REQUIRED_NOTE,
    hasUpgradeNote: false,
    version: "1.2.0",
  });

  assert.isTrue(result.isValid);
  assert.isFalse(result.requiresUpgradeNote);
  assert.deepEqual(result.triggeringSections, []);
});
