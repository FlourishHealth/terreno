import {execSync} from "node:child_process";

interface SimDevice {
  isAvailable?: boolean;
  name: string;
  udid: string;
}

interface SimList {
  devices: Record<string, SimDevice[]>;
}

const list = JSON.parse(
  execSync("xcrun simctl list devices available -j", {encoding: "utf8"})
) as SimList;

const runtimeKey =
  Object.keys(list.devices)
    .filter((key) => /SimRuntime\.iOS-18-/.test(key))
    .sort()
    .at(-1) ??
  Object.keys(list.devices)
    .filter((key) => /SimRuntime\.iOS-/.test(key) && !/iOS-26-/.test(key))
    .sort()
    .at(-1);

if (!runtimeKey) {
  console.error("::error::Could not find a stable iOS simulator runtime");
  process.exit(1);
}

const platformVersion = runtimeKey.match(/iOS-(\d+-\d+)/)?.[1]?.replace("-", ".");
if (!platformVersion) {
  console.error("::error::Could not parse iOS platform version");
  process.exit(1);
}

const devices = list.devices[runtimeKey].filter((device) => device.isAvailable !== false);
const preferredNames = ["iPhone 16", "iPhone 15"];
const picked =
  preferredNames
    .map((name) => devices.find((device) => device.name === name))
    .find(Boolean) ?? devices.find((device) => device.name.startsWith("iPhone"));

if (!picked) {
  console.error(`::error::Could not find an iPhone simulator for iOS ${platformVersion}`);
  process.exit(1);
}

console.log(`export IOS_PLATFORM_VERSION=${JSON.stringify(platformVersion)}`);
console.log(`export IOS_DEVICE_NAME=${JSON.stringify(picked.name)}`);
console.log(`export IOS_DEVICE_UDID=${JSON.stringify(picked.udid)}`);
