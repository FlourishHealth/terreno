import {execFileSync} from "node:child_process";
import {appendFileSync, existsSync} from "node:fs";

type Platform = "android" | "ios";

interface CliOptions {
  envFile?: string;
  fallbackProfile?: string;
  platform?: Platform;
  profile?: string;
}

interface EasDownloadResult {
  path: string;
}

interface EasBuild {
  id: string;
}

const EAS_CLI_PACKAGE = "eas-cli@latest";
const NO_FINISHED_BUILDS_ERROR = "EAS did not return any finished builds for the selected profile.";
const DEFAULT_BUILD_PROFILES: Record<Platform, string> = {
  android: "development",
  ios: "development:simulator",
};
const PLATFORM_ENV_KEYS: Record<Platform, string> = {
  android: "ANDROID_APP_PATH",
  ios: "IOS_APP_PATH",
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const parsePlatform = (value: string | undefined): Platform => {
  if (value === "android" || value === "ios") {
    return value;
  }

  throw new Error("Set --platform to android or ios.");
};

const parseArgs = (): CliOptions => {
  const options: CliOptions = {};
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--platform") {
      options.platform = parsePlatform(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--env-file") {
      options.envFile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--profile") {
      options.profile = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--fallback-profile") {
      options.fallbackProfile = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const parseLatestBuild = (rawOutput: string): EasBuild => {
  const parsed = JSON.parse(rawOutput) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("EAS build list output was not an array.");
  }

  const latestBuild = parsed[0] as unknown;

  if (!isRecord(latestBuild)) {
    throw new Error(NO_FINISHED_BUILDS_ERROR);
  }

  if (typeof latestBuild.id !== "string" || latestBuild.id.length === 0) {
    throw new Error("Latest EAS build did not include an id.");
  }

  return {id: latestBuild.id};
};

const parseEasDownloadResult = (rawOutput: string): EasDownloadResult => {
  const parsed = JSON.parse(rawOutput) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("EAS download output was not an object.");
  }

  if (typeof parsed.path !== "string" || parsed.path.length === 0) {
    throw new Error("EAS download output did not include a path.");
  }

  return {path: parsed.path};
};

const getLatestBuild = ({
  platform,
  profile,
}: {
  platform: Platform;
  profile: string;
}): EasBuild => {
  const platformArgs =
    platform === "ios"
      ? ["--simulator"]
      : ["--distribution", "internal"];
  const rawOutput = execFileSync(
    "bunx",
    [
      EAS_CLI_PACKAGE,
      "build:list",
      "--platform",
      platform,
      "--status",
      "finished",
      "--build-profile",
      profile,
      "--limit",
      "1",
      "--json",
      "--non-interactive",
      ...platformArgs,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }
  );

  return parseLatestBuild(rawOutput);
};

const downloadBuild = ({buildId}: {buildId: string}): EasDownloadResult => {
  const rawOutput = execFileSync(
    "bunx",
    [
      EAS_CLI_PACKAGE,
      "build:download",
      "--build-id",
      buildId,
      "--json",
      "--non-interactive",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }
  );

  return parseEasDownloadResult(rawOutput);
};

const writeEnvironmentVariable = ({
  envFile,
  key,
  value,
}: {
  envFile: string;
  key: string;
  value: string;
}): void => {
  appendFileSync(envFile, `${key}=${value}\n`);
};

const outputToString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8").trim();
  }

  return "";
};

const getProcessOutput = (error: unknown): string => {
  if (!isRecord(error)) {
    return "";
  }

  return [outputToString(error.stdout), outputToString(error.stderr)]
    .filter((output) => output.length > 0)
    .join("\n");
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const getLatestBuildWithFallback = ({
  fallbackProfile,
  platform,
  primaryProfile,
}: {
  fallbackProfile?: string;
  platform: Platform;
  primaryProfile: string;
}): EasBuild => {
  const hasFallbackProfile =
    typeof fallbackProfile === "string" &&
    fallbackProfile.length > 0 &&
    fallbackProfile !== primaryProfile;
  const profiles = hasFallbackProfile
    ? [primaryProfile, fallbackProfile]
    : [primaryProfile];

  let latestError: unknown;

  for (let index = 0; index < profiles.length; index += 1) {
    const profile = profiles[index];
    try {
      const resolvedBuild = getLatestBuild({platform, profile});
      try {
        // #region agent log
        appendFileSync(
          "/opt/cursor/logs/debug.log",
          `${JSON.stringify({
            hypothesisId: "H5",
            location: "demo/appium/downloadLatestEasBuild.ts:240",
            message: "Resolved latest EAS build id",
            data: {
              buildId: resolvedBuild.id,
              platform,
              profile,
              usedFallbackProfile: profile !== primaryProfile,
            },
            timestamp: Date.now(),
          })}\n`
        );
        // #endregion
      } catch {}

      return resolvedBuild;
    } catch (error) {
      latestError = error;
      const hasNextProfile = index < profiles.length - 1;
      const message = getErrorMessage(error);
      const shouldTryNextProfile =
        hasNextProfile && message.includes(NO_FINISHED_BUILDS_ERROR);
      if (!shouldTryNextProfile) {
        throw error;
      }

      const nextProfile = profiles[index + 1];
      process.stderr.write(
        `No finished builds for profile "${profile}". Retrying with "${nextProfile}".\n`
      );
    }
  }

  throw latestError instanceof Error
    ? latestError
    : new Error(NO_FINISHED_BUILDS_ERROR);
};

const main = (): void => {
  const options = parseArgs();

  if (!options.platform) {
    throw new Error("Missing required --platform argument.");
  }

  const primaryProfile = options.profile ?? DEFAULT_BUILD_PROFILES[options.platform];
  const latestBuild = getLatestBuildWithFallback({
    fallbackProfile: options.fallbackProfile,
    platform: options.platform,
    primaryProfile,
  });
  const result = downloadBuild({buildId: latestBuild.id});

  if (!existsSync(result.path)) {
    throw new Error(`Downloaded EAS artifact was not found at ${result.path}.`);
  }

  try {
    // #region agent log
    appendFileSync(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({
        hypothesisId: "H3",
        location: "demo/appium/downloadLatestEasBuild.ts:301",
        message: "Downloaded EAS artifact path",
        data: {
          appPath: result.path,
          buildId: latestBuild.id,
          envKey: PLATFORM_ENV_KEYS[options.platform],
          platform: options.platform,
          profile: primaryProfile,
        },
        timestamp: Date.now(),
      })}\n`
    );
    // #endregion
  } catch {}

  const envKey = PLATFORM_ENV_KEYS[options.platform];

  if (options.envFile) {
    writeEnvironmentVariable({
      envFile: options.envFile,
      key: envKey,
      value: result.path,
    });
  }

  process.stdout.write(`${envKey}=${result.path}\n`);
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const processOutput = getProcessOutput(error);
  process.stderr.write(`${message}\n`);
  if (processOutput.length > 0) {
    process.stderr.write(`${processOutput}\n`);
  }
  process.exit(1);
}
