import {execSync} from "node:child_process";

interface SimDevice {
  isAvailable?: boolean;
  name: string;
  udid: string;
}

interface SimList {
  devices: Record<string, SimDevice[]>;
}

interface RuntimeVersion {
  major: number;
  minor: number;
}

interface RuntimeCandidate {
  key: string;
  version: RuntimeVersion;
}

const parseRuntimeVersion = (runtimeKey: string): RuntimeVersion | undefined => {
  const versionMatch = runtimeKey.match(/iOS-(\d+)-(\d+)/);
  if (!versionMatch) {
    return undefined;
  }

  const major = Number.parseInt(versionMatch[1], 10);
  const minor = Number.parseInt(versionMatch[2], 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    return undefined;
  }

  return {major, minor};
};

const compareRuntimeVersions = (left: RuntimeVersion, right: RuntimeVersion): number => {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  return left.minor - right.minor;
};

const getMaxSupportedSimulatorSdkVersion = (): RuntimeVersion | undefined => {
  const sdkListOutput = execSync("xcodebuild -showsdks", {encoding: "utf8"});
  const sdkVersionMatches = [...sdkListOutput.matchAll(/iphonesimulator(\d+)\.(\d+)/g)];
  const parsedVersions = sdkVersionMatches
    .map((match) => {
      const major = Number.parseInt(match[1], 10);
      const minor = Number.parseInt(match[2], 10);
      if (Number.isNaN(major) || Number.isNaN(minor)) {
        return undefined;
      }

      return {major, minor};
    })
    .filter((version): version is RuntimeVersion => version !== undefined)
    .sort(compareRuntimeVersions);

  return parsedVersions.at(-1);
};

const list = JSON.parse(
  execSync("xcrun simctl list devices available -j", {encoding: "utf8"})
) as SimList;

const runtimeCandidates = Object.keys(list.devices)
  .filter((key) => /SimRuntime\.iOS-/.test(key) && !/iOS-26-/.test(key))
  .map((key): RuntimeCandidate | undefined => {
    const version = parseRuntimeVersion(key);
    if (!version) {
      return undefined;
    }

    return {key, version};
  })
  .filter((candidate): candidate is RuntimeCandidate => candidate !== undefined);

const maxSupportedSdkVersion = getMaxSupportedSimulatorSdkVersion();
const sdkCompatibleCandidates = maxSupportedSdkVersion
  ? runtimeCandidates.filter(
      (candidate) => compareRuntimeVersions(candidate.version, maxSupportedSdkVersion) <= 0
    )
  : runtimeCandidates;

const prioritizedCandidates = [
  ...sdkCompatibleCandidates.filter((candidate) => candidate.version.major === 18),
  ...sdkCompatibleCandidates.filter((candidate) => candidate.version.major !== 18),
].sort((left, right) => compareRuntimeVersions(left.version, right.version));

const selectedRuntime = prioritizedCandidates.at(-1);
if (!selectedRuntime) {
  const maxSupportedVersionText = maxSupportedSdkVersion
    ? `${maxSupportedSdkVersion.major}.${maxSupportedSdkVersion.minor}`
    : "unknown";
  console.error(
    `::error::Could not find an iOS simulator runtime supported by the installed Xcode SDK (${maxSupportedVersionText})`
  );
  process.exit(1);
}

const runtimeKey = selectedRuntime.key;
const devicesForRuntime = list.devices[runtimeKey];
if (!Array.isArray(devicesForRuntime)) {
  console.error(`::error::No simulator devices found for runtime ${runtimeKey}`);
  process.exit(1);
}

const platformVersion = `${selectedRuntime.version.major}.${selectedRuntime.version.minor}`;
const devices = devicesForRuntime.filter((device: SimDevice) => device.isAvailable !== false);
const preferredNames = ["iPhone 16", "iPhone 15"];
const picked =
  preferredNames
    .map((name) => devices.find((device: SimDevice) => device.name === name))
    .find(Boolean) ?? devices.find((device) => device.name.startsWith("iPhone"));

if (!picked) {
  console.error(`::error::Could not find an iPhone simulator for iOS ${platformVersion}`);
  process.exit(1);
}

console.log(`export IOS_PLATFORM_VERSION=${JSON.stringify(platformVersion)}`);
console.log(`export IOS_DEVICE_NAME=${JSON.stringify(picked.name)}`);
console.log(`export IOS_DEVICE_UDID=${JSON.stringify(picked.udid)}`);
