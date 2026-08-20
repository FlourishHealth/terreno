import {describe, it} from "bun:test";
import {assert} from "chai";

import {
  assembleChangelog,
  checkUnreleasedSection,
  parseChangelogFragment,
  renderFragmentBody,
  renderUnreleasedSection,
  UNRELEASED_POINTER,
} from "./lib";

const CHANGELOG_WITH_POINTER = `# Changelog

## [Unreleased]

${UNRELEASED_POINTER}

## [57.0.0] - 2026-08-20

### Added

- Existing release note.
`;

describe("parseChangelogFragment", () => {
  it("parses a kebab-case file with a category header", (): void => {
    const result = parseChangelogFragment({
      content: `---
category: Added
---

SendGrid mail provider with sandbox mode.
`,
      fileName: "sendgrid-mail-provider.md",
    });

    assert.deepEqual(result, {
      body: "SendGrid mail provider with sandbox mode.",
      category: "Added",
      fileName: "sendgrid-mail-provider.md",
    });
  });

  it("rejects a reserved README file", (): void => {
    const result = parseChangelogFragment({
      content: `---
category: Added
---

Body
`,
      fileName: "README.md",
    });

    assert.include(result, {fileName: "README.md"});
    assert.match((result as {message: string}).message, /reserved/);
  });

  it("rejects a missing YAML header", (): void => {
    const result = parseChangelogFragment({
      content: "### Added\n\n- Forgot the header\n",
      fileName: "forgot-header.md",
    });

    assert.match((result as {message: string}).message, /missing YAML header/);
  });

  it("rejects an unknown category", (): void => {
    const result = parseChangelogFragment({
      content: `---
category: Improvement
---

Something happened.
`,
      fileName: "unknown-category.md",
    });

    assert.match((result as {message: string}).message, /not one of/);
  });

  it("rejects an empty body", (): void => {
    const result = parseChangelogFragment({
      content: `---
category: Fixed
---

`,
      fileName: "empty-body.md",
    });

    assert.match((result as {message: string}).message, /body is empty/);
  });
});

describe("renderFragmentBody", () => {
  it("prefixes a dash when the body is prose", (): void => {
    assert.equal(renderFragmentBody("New Filter component"), "- New Filter component");
  });

  it("indents continuation lines when wrapping prose", (): void => {
    assert.equal(
      renderFragmentBody("First line\nstill the same bullet"),
      "- First line\n  still the same bullet",
    );
  });

  it("keeps an existing markdown list", (): void => {
    assert.equal(
      renderFragmentBody("- First item\n- Second item"),
      "- First item\n- Second item",
    );
  });
});

describe("renderUnreleasedSection", () => {
  it("groups fragments by category in Keep a Changelog order", (): void => {
    const rendered = renderUnreleasedSection([
      {
        body: "Fix consent layout",
        category: "Fixed",
        fileName: "consent-layout.md",
      },
      {
        body: "SendGrid provider",
        category: "Added",
        fileName: "sendgrid-mail-provider.md",
      },
      {
        body: "Rename a public API",
        category: "Changed",
        fileName: "rename-api.md",
      },
    ]);

    assert.equal(
      rendered,
      `### Added

- SendGrid provider

### Changed

- Rename a public API

### Fixed

- Fix consent layout`,
    );
  });
});

describe("checkUnreleasedSection", () => {
  it("passes when Unreleased points at changelog/unreleased/", (): void => {
    const failure = checkUnreleasedSection(CHANGELOG_WITH_POINTER);
    assert.isUndefined(failure);
  });

  it("fails when Unreleased still has ### headings", (): void => {
    const failure = checkUnreleasedSection(`# Changelog

## [Unreleased]

### Added

- Shared file that conflicts on every PR

## [57.0.0] - 2026-08-20
`);

    assert.equal(failure?.fileName, "CHANGELOG.md");
    assert.match(failure?.message ?? "", /must not contain ### headings/);
  });
});

describe("assembleChangelog", () => {
  it("folds fragments into a dated version section and keeps the pointer", (): void => {
    const assembled = assembleChangelog({
      changelog: CHANGELOG_WITH_POINTER,
      date: "2026-08-21",
      fragments: [
        {
          body: "SendGrid mail provider",
          category: "Added",
          fileName: "sendgrid-mail-provider.md",
        },
        {
          body: "Deprecate RTK collection CRUD",
          category: "Deprecated",
          fileName: "rtk-sync-deprecated.md",
        },
      ],
      version: "57.1.0",
    });

    assert.include(assembled, UNRELEASED_POINTER);
    assert.include(assembled, "## [57.1.0] - 2026-08-21");
    assert.include(assembled, "### Added\n\n- SendGrid mail provider");
    assert.include(assembled, "### Deprecated\n\n- Deprecate RTK collection CRUD");
    assert.include(assembled, "## [57.0.0] - 2026-08-20");
    assert.notInclude(assembled, "### Added\n\n- Shared file");
  });

  it("throws when there are no fragments", (): void => {
    assert.throws(
      () =>
        assembleChangelog({
          changelog: CHANGELOG_WITH_POINTER,
          date: "2026-08-21",
          fragments: [],
          version: "57.1.0",
        }),
      /no changelog fragments/,
    );
  });
});
