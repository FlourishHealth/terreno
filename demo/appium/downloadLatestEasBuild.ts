import {execFileSync} from "node:child_process";
import {appendFileSync, existsSync} from "node:fs";

type Platform = "android" | "ios";

interface CliOptions {
  envFile?: string;
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
    throw new Error("EAS did not return any finished dev-client builds.");
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

const getLatestDevClientBuild = ({
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

const downloadDevClientBuild = ({buildId}: {buildId: string}): EasDownloadResult => {
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

const main = (): void => {
  const options = parseArgs();

  if (!options.platform) {
    throw new Error("Missing required --platform argument.");
  }

  const profile = options.profile ?? DEFAULT_BUILD_PROFILES[options.platform];
  const latestBuild = getLatestDevClientBuild({
    platform: options.platform,
    profile,
  });
  const result = downloadDevClientBuild({buildId: latestBuild.id});

  if (!existsSync(result.path)) {
    throw new Error(`Downloaded EAS artifact was not found at ${result.path}.`);
  }

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
