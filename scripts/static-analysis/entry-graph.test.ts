import {describe, test} from "bun:test";
import {join} from "node:path";
import {assert} from "chai";

import {type KnipReport, unusedFilePathsFromKnipReport} from "./lib";

const REPO_ROOT = join(import.meta.dir, "../..");

const KNOWN_ENTRY_FILES = [
  "admin-frontend/src/isolated/AdminFieldRenderer.isolated.tsx",
  "ai/src/isolated/gptStream.isolated.ts",
  "rtk/src/isolated/emptyApi.isolated.ts",
  "syncdb/src/isolated/defaultPersisterFactoryNative.isolated.ts",
  "scripts/static-analysis/lib.test.ts",
  ".github/scripts/architectural-pr-review.test.ts",
] as const;

const FRONTEND_TOOL_BLIND_DEPENDENCIES = new Map<string, string[]>([
  [
    "admin-spa/package.json",
    [
      "@expo/vector-icons",
      "@react-native-async-storage/async-storage",
      "expo-font",
      "expo-splash-screen",
      "expo-status-bar",
      "expo-system-ui",
      "expo-updates",
      "jspdf",
      "redux-persist",
    ],
  ],
  [
    "example-frontend/package.json",
    ["expo-crypto", "expo-print", "expo-sharing", "expo-system-ui", "jspdf"],
  ],
  [
    "demo/package.json",
    [
      "@expo-google-fonts/comfortaa",
      "@expo/vector-icons",
      "@react-native-community/datetimepicker",
      "@shopify/react-native-skia",
      "crypto-browserify",
      "expo-system-ui",
      "react-native-actions-sheet",
      "stream-browserify",
    ],
  ],
  [
    "ui/package.json",
    [
      "@react-native-community/blur",
      "@react-navigation/native",
      "expo-notifications",
      "react-date-picker",
      "react-native-permissions",
      "react-native-webview",
    ],
  ],
]);

const isTask11UnusedFileLeak = (file: string): boolean => {
  if (file.includes(".isolated.")) {
    return true;
  }
  const isRepoScriptTest =
    (file.startsWith("scripts/") || file.startsWith(".github/scripts/")) && file.includes(".test.");
  return isRepoScriptTest;
};

const runDefaultKnipReport = (): KnipReport => {
  const result = Bun.spawnSync({
    cmd: [
      "node",
      "node_modules/knip/bin/knip.js",
      "--cache",
      "--no-exit-code",
      "--reporter",
      "json",
    ],
    cwd: REPO_ROOT,
    stderr: "pipe",
    stdout: "pipe",
  });
  const stderr = result.stderr.toString().trim();
  if (result.exitCode !== 0) {
    throw new Error(stderr || "Knip failed without a diagnostic");
  }
  return JSON.parse(result.stdout.toString()) as KnipReport;
};

const dependencyIssueNames = ({file, report}: {file: string; report: KnipReport}): string[] => {
  const packageIssues = report.issues.filter(
    (issue) => issue.file === file || issue.file.startsWith(file.replace("package.json", ""))
  );
  return packageIssues
    .flatMap((issue) => [
      ...(issue.dependencies ?? []),
      ...(issue.devDependencies ?? []),
      ...(issue.optionalPeerDependencies ?? []),
      ...(issue.unlisted ?? []),
    ])
    .map((issue) => issue.name)
    .sort();
};

describe("Knip entry graph", (): void => {
  test(
    "does not report isolated suites or repo script tests as unused files",
    (): void => {
      const unusedFiles = unusedFilePathsFromKnipReport(runDefaultKnipReport());
      for (const knownEntry of KNOWN_ENTRY_FILES) {
        assert.notInclude(unusedFiles, knownEntry);
      }
      assert.deepEqual(unusedFiles.filter(isTask11UnusedFileLeak), []);
    },
    {timeout: 180_000}
  );

  test(
    "does not report mcp-server tests as unused files",
    (): void => {
      const unusedFiles = unusedFilePathsFromKnipReport(runDefaultKnipReport());
      assert.notInclude(unusedFiles, "mcp-server/src/__tests__/tools.test.ts");
      assert.notInclude(unusedFiles, "mcp-server/src/__tests__/preload.ts");
      assert.deepEqual(
        unusedFiles.filter((file) => file.startsWith("mcp-server/src/__tests__/")),
        []
      );
    },
    {timeout: 180_000}
  );

  test(
    "does not report codegen, Metro stubs, Playwright, fingerprint, or Docusaurus theme files as unused",
    (): void => {
      const unusedFiles = unusedFilePathsFromKnipReport(runDefaultKnipReport());
      const knownToolEntries = [
        "example-frontend/openapi-config.ts",
        "example-frontend/comms-openapi-config.ts",
        "example-frontend/jspdf-native-stub.js",
        "example-frontend/fingerprint.config.js",
        "example-frontend/playwright.circleci.config.ts",
        "demo/jspdf-native-stub.js",
        "demo/fingerprint.config.js",
        "admin-spa/jspdf-native-stub.js",
        "admin-spa/e2e/serveTestApp.ts",
        "ui/babel.config.js",
        "website/src/theme/DocItem/Footer/index.tsx",
        "scripts/ci/prepare-package-publish.mjs",
      ];
      for (const knownEntry of knownToolEntries) {
        assert.notInclude(unusedFiles, knownEntry);
      }
    },
    {timeout: 180_000}
  );

  test(
    "does not report generated Expo skill script copies as unused files",
    (): void => {
      const unusedFiles = unusedFilePathsFromKnipReport(runDefaultKnipReport());
      assert.deepEqual(
        unusedFiles.filter((file) => file.includes("expo-cicd-workflows/scripts/")),
        []
      );
    },
    {timeout: 180_000}
  );

  test(
    "does not report frontend runtime-only dependencies",
    (): void => {
      const report = runDefaultKnipReport();
      for (const [packageFile, dependencyNames] of FRONTEND_TOOL_BLIND_DEPENDENCIES) {
        const reportedNames = dependencyIssueNames({file: packageFile, report});
        for (const dependencyName of dependencyNames) {
          assert.notInclude(reportedNames, dependencyName, `${packageFile}: ${dependencyName}`);
        }
      }
    },
    {timeout: 180_000}
  );
});
