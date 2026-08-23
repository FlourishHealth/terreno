import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";

/** Published npm packages — keep in sync with `.github/workflows/publish-on-tag.yml`. */
export const PUBLISHED_PACKAGES = [
  "api",
  "test",
  "ui",
  "rtk",
  "admin-backend",
  "admin-frontend",
  "admin-spa",
  "ai",
  "api-health",
  "comms",
  "feature-flags",
  "mcp-server",
  "cli",
] as const;

export type PublishedPackage = (typeof PUBLISHED_PACKAGES)[number];

export interface PackageJson {
  files?: string[];
  license?: string;
}

export interface LicenseCheckFailure {
  packageDir: PublishedPackage;
  message: string;
}

export const readPackageJson = (repoRoot: string, packageDir: PublishedPackage): PackageJson => {
  const packageJsonPath = join(repoRoot, packageDir, "package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
};

export const readRootLicense = (repoRoot: string): string | undefined => {
  const rootPackageJsonPath = join(repoRoot, "package.json");
  if (!existsSync(rootPackageJsonPath)) {
    return undefined;
  }

  const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf8")) as PackageJson;
  return rootPackageJson.license;
};

export const checkLicenseCoverage = ({
  repoRoot,
  publishedPackages = PUBLISHED_PACKAGES,
}: {
  repoRoot: string;
  publishedPackages?: readonly PublishedPackage[];
}): LicenseCheckFailure[] => {
  const failures: LicenseCheckFailure[] = [];
  const rootLicense = readRootLicense(repoRoot);

  if (!rootLicense) {
    failures.push({
      packageDir: "api",
      message: "root package.json is missing a license field",
    });
    return failures;
  }

  for (const packageDir of publishedPackages) {
    const licensePath = join(repoRoot, packageDir, "LICENSE");

    if (!existsSync(licensePath)) {
      failures.push({
        packageDir,
        message: "missing LICENSE file",
      });
    }

    const packageJson = readPackageJson(repoRoot, packageDir);

    if (packageJson.license !== rootLicense) {
      failures.push({
        packageDir,
        message: `package.json license "${packageJson.license ?? "(missing)"}" does not match root license "${rootLicense}"`,
      });
    }

    if (packageJson.files && !packageJson.files.includes("LICENSE")) {
      failures.push({
        packageDir,
        message: 'package.json files array does not include "LICENSE"',
      });
    }
  }

  return failures;
};
