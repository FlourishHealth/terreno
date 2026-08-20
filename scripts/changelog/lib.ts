export const CHANGELOG_CATEGORIES = [
  "Breaking",
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

export const UNRELEASED_HEADING = "## [Unreleased]";

export const UNRELEASED_POINTER =
  "Unreleased changes live in [`changelog/unreleased/`](changelog/unreleased/). Add one Markdown file per feature (see that directory's README) instead of editing this section.";

const FRAGMENT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const RELEASE_HEADING_PATTERN = /^## \[([^\]]+)\](?:\s+-\s+.*)?$/gm;
const UNRELEASED_HEADING_IN_SECTION_PATTERN = /^###\s+/m;

export const RESERVED_FRAGMENT_NAMES = new Set(["readme.md"]);

export interface ChangelogFragment {
  body: string;
  category: ChangelogCategory;
  fileName: string;
}

export interface ChangelogValidationFailure {
  fileName: string;
  message: string;
}

const isChangelogCategory = (value: string): value is ChangelogCategory => {
  return (CHANGELOG_CATEGORIES as readonly string[]).includes(value);
};

const parseFrontmatterCategory = (frontmatter: string): string | undefined => {
  const categoryMatch = frontmatter.match(/^\s*category:\s*(.+?)\s*$/m);
  return categoryMatch?.[1];
};

export const isFragmentFileName = (fileName: string): boolean => {
  if (RESERVED_FRAGMENT_NAMES.has(fileName.toLowerCase())) {
    return false;
  }

  return FRAGMENT_NAME_PATTERN.test(fileName);
};

export const parseChangelogFragment = ({
  content,
  fileName,
}: {
  content: string;
  fileName: string;
}): ChangelogFragment | ChangelogValidationFailure => {
  if (!isFragmentFileName(fileName)) {
    return {
      fileName,
      message:
        "file name must be kebab-case.md (for example sendgrid-mail-provider.md); README.md is reserved",
    };
  }

  const frontmatterMatch = content.trimStart().match(FRONTMATTER_PATTERN);
  if (!frontmatterMatch) {
    return {
      fileName,
      message: "missing YAML header; start the file with --- / category: <Category> / ---",
    };
  }

  const category = parseFrontmatterCategory(frontmatterMatch[1] ?? "");
  if (!category) {
    return {
      fileName,
      message: "YAML header is missing a category field",
    };
  }

  if (!isChangelogCategory(category)) {
    return {
      fileName,
      message: `category "${category}" is not one of: ${CHANGELOG_CATEGORIES.join(", ")}`,
    };
  }

  const body = (frontmatterMatch[2] ?? "").trim();
  if (!body) {
    return {
      fileName,
      message: "body is empty; describe the user-facing change after the header",
    };
  }

  return {body, category, fileName};
};

export const renderFragmentBody = (body: string): string => {
  const trimmed = body.trim();
  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0] ?? "";

  if (firstLine.startsWith("- ")) {
    return trimmed;
  }

  const [lead = "", ...rest] = lines;
  const continuation = rest.map((line) => {
    if (line.length === 0) {
      return "";
    }

    return `  ${line}`;
  });

  return [`- ${lead}`, ...continuation].join("\n");
};

export const groupFragmentsByCategory = (
  fragments: ChangelogFragment[],
): Map<ChangelogCategory, ChangelogFragment[]> => {
  const grouped = new Map<ChangelogCategory, ChangelogFragment[]>();

  for (const category of CHANGELOG_CATEGORIES) {
    grouped.set(category, []);
  }

  const sorted = [...fragments].sort((left, right) =>
    left.fileName.localeCompare(right.fileName),
  );

  for (const fragment of sorted) {
    grouped.get(fragment.category)?.push(fragment);
  }

  return grouped;
};

export const renderUnreleasedSection = (fragments: ChangelogFragment[]): string => {
  const grouped = groupFragmentsByCategory(fragments);
  const sections: string[] = [];

  for (const category of CHANGELOG_CATEGORIES) {
    const categoryFragments = grouped.get(category) ?? [];
    if (categoryFragments.length === 0) {
      continue;
    }

    const bullets = categoryFragments.map((fragment) => renderFragmentBody(fragment.body));
    sections.push(`### ${category}\n\n${bullets.join("\n")}`);
  }

  return sections.join("\n\n");
};

export const getUnreleasedSection = (changelog: string): string | undefined => {
  const headings = [...changelog.matchAll(RELEASE_HEADING_PATTERN)];
  const unreleasedHeading = headings.find((match) => match[1] === "Unreleased");

  if (!unreleasedHeading) {
    return undefined;
  }

  const headingIndex = headings.indexOf(unreleasedHeading);
  const nextHeading = headings[headingIndex + 1];
  const sectionStart = (unreleasedHeading.index ?? 0) + unreleasedHeading[0].length;
  const sectionEnd = nextHeading?.index ?? changelog.length;

  return changelog.slice(sectionStart, sectionEnd);
};

export const checkUnreleasedSection = (
  changelog: string,
): ChangelogValidationFailure | undefined => {
  const unreleasedSection = getUnreleasedSection(changelog);

  if (unreleasedSection === undefined) {
    return {
      fileName: "CHANGELOG.md",
      message: "missing ## [Unreleased] section",
    };
  }

  if (UNRELEASED_HEADING_IN_SECTION_PATTERN.test(unreleasedSection)) {
    return {
      fileName: "CHANGELOG.md",
      message:
        "## [Unreleased] must not contain ### headings; add a file under changelog/unreleased/ instead",
    };
  }

  if (!unreleasedSection.includes("changelog/unreleased/")) {
    return {
      fileName: "CHANGELOG.md",
      message: "## [Unreleased] must point contributors at changelog/unreleased/",
    };
  }

  return undefined;
};

export const assembleChangelog = ({
  changelog,
  date,
  fragments,
  version,
}: {
  changelog: string;
  date: string;
  fragments: ChangelogFragment[];
  version: string;
}): string => {
  if (fragments.length === 0) {
    throw new Error("no changelog fragments to assemble; refusing empty release");
  }

  const unreleasedSection = getUnreleasedSection(changelog);
  if (unreleasedSection === undefined) {
    throw new Error("CHANGELOG.md is missing ## [Unreleased]");
  }

  const renderedEntries = renderUnreleasedSection(fragments);
  const versionHeading = `## [${version}] - ${date}`;
  const replacement = `\n\n${UNRELEASED_POINTER}\n\n${versionHeading}\n\n${renderedEntries}\n\n`;

  const headings = [...changelog.matchAll(RELEASE_HEADING_PATTERN)];
  const unreleasedHeading = headings.find((match) => match[1] === "Unreleased");
  if (!unreleasedHeading) {
    throw new Error("CHANGELOG.md is missing ## [Unreleased]");
  }

  const headingIndex = headings.indexOf(unreleasedHeading);
  const nextHeading = headings[headingIndex + 1];
  const sectionStart = (unreleasedHeading.index ?? 0) + unreleasedHeading[0].length;
  const sectionEnd = nextHeading?.index ?? changelog.length;

  return `${changelog.slice(0, sectionStart)}${replacement}${changelog.slice(sectionEnd)}`;
};
