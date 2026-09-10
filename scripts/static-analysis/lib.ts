import {existsSync} from "node:fs";
import {extname, join} from "node:path";

export interface BiomeRun {
  cwd: string;
  files: string[];
}

export interface KnipIssue {
  name: string;
  namespace?: string;
  [key: string]: unknown;
}

export interface KnipFileIssues {
  file: string;
  owners?: Array<{name: string}>;
  [issueType: string]: string | KnipIssue[] | Array<{name: string}> | undefined;
}

export interface KnipReport {
  issues: KnipFileIssues[];
}

export interface KnipBaseline {
  generatedAt: string;
  issues: string[];
  version: 1;
}

export interface KnipComparison {
  currentCount: number;
  newIssues: string[];
  ok: boolean;
}

const BIOME_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

export const parseChangedFileOutput = (output: string): string[] => {
  return output
    .split(output.includes("\0") ? "\0" : "\n")
    .map((file) => file.trim())
    .filter(Boolean);
};

export const selectAnalyzableFiles = (
  files: string[],
  doesFileExist: (file: string) => boolean = existsSync
): string[] => {
  return [...new Set(files)]
    .filter((file) => BIOME_EXTENSIONS.has(extname(file)))
    .filter(doesFileExist)
    .sort();
};

export const groupFilesByBiomeDirectory = ({
  files,
  repoRoot,
  doesConfigExist = existsSync,
}: {
  files: string[];
  repoRoot: string;
  doesConfigExist?: (path: string) => boolean;
}): BiomeRun[] => {
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const [workspace, ...workspacePath] = file.split("/");
    const workspaceDirectory = join(repoRoot, workspace);
    const hasWorkspaceConfig =
      workspacePath.length > 0 &&
      (doesConfigExist(join(workspaceDirectory, "biome.json")) ||
        doesConfigExist(join(workspaceDirectory, "biome.jsonc")));
    if (!hasWorkspaceConfig) {
      continue;
    }
    groups.set(workspaceDirectory, [
      ...(groups.get(workspaceDirectory) ?? []),
      workspacePath.join("/"),
    ]);
  }

  return [...groups.entries()]
    .map(([cwd, groupedFiles]) => ({cwd, files: groupedFiles.sort()}))
    .sort((left, right) => left.cwd.localeCompare(right.cwd));
};

export const unusedFilePathsFromKnipReport = (report: KnipReport): string[] => {
  const paths = new Set<string>();
  for (const fingerprint of fingerprintKnipReport({mode: "default", report})) {
    if (!fingerprint.startsWith("default:files:")) {
      continue;
    }
    const remainder = fingerprint.slice("default:files:".length);
    const filePath = remainder.split(":")[0];
    if (filePath) {
      paths.add(filePath);
    }
  }
  return [...paths].sort();
};

export const isIsolatedOrRepoScriptTestFile = (file: string): boolean => {
  if (file.includes(".isolated.")) {
    return true;
  }
  const isUnderRepoScripts = file.startsWith("scripts/") || file.startsWith(".github/scripts/");
  if (!isUnderRepoScripts) {
    return false;
  }
  return file.includes(".test.");
};

export const fingerprintKnipReport = ({
  mode,
  report,
}: {
  mode: "default" | "production";
  report: KnipReport;
}): string[] => {
  const fingerprints: string[] = [];

  for (const fileIssues of report.issues) {
    for (const [issueType, value] of Object.entries(fileIssues)) {
      if (issueType === "file" || issueType === "owners" || !Array.isArray(value)) {
        continue;
      }

      for (const issue of value) {
        if (!("name" in issue)) {
          continue;
        }
        const namespace = "namespace" in issue ? issue.namespace : undefined;
        fingerprints.push(
          [mode, issueType, fileIssues.file, namespace, issue.name].filter(Boolean).join(":")
        );
      }
    }
  }

  return [...new Set(fingerprints)].sort();
};

export const compareKnipBaseline = ({
  currentIssues,
  baseline,
}: {
  currentIssues: string[];
  baseline: KnipBaseline;
}): KnipComparison => {
  const baselineIssues = new Set(baseline.issues);
  const newIssues = currentIssues.filter((issue) => !baselineIssues.has(issue));
  return {
    currentCount: currentIssues.length,
    newIssues,
    ok: newIssues.length === 0,
  };
};
