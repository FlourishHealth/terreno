import type express from "express";

import {asyncHandler} from "./api";
import {VersionConfig} from "./models/versionConfig";
import type {TerrenoPlugin} from "./terrenoPlugin";

export type VersionCheckStatus = "ok" | "warning" | "required";

export interface VersionCheckResponse {
  message?: string;
  status: VersionCheckStatus;
  updateUrl?: string;
}

const DEFAULT_WARNING_MESSAGE =
  "A new version is available. Please update for the best experience.";
const DEFAULT_REQUIRED_MESSAGE = "This version is no longer supported. Please update to continue.";

/**
 * Performs version check logic: compares client version against platform-specific thresholds.
 * Returns "required" if version < requiredVersion, "warning" if version < warningVersion, else "ok".
 */
export const computeVersionCheck = (
  config: {
    webWarningVersion: number;
    webRequiredVersion: number;
    mobileWarningVersion: number;
    mobileRequiredVersion: number;
    warningMessage: string;
    requiredMessage: string;
    updateUrl?: string;
  } | null,
  version: number,
  platform: "web" | "mobile"
): VersionCheckResponse => {
  if (!config) {
    return {status: "ok"};
  }

  const warningVersion =
    platform === "web" ? config.webWarningVersion : config.mobileWarningVersion;
  const requiredVersion =
    platform === "web" ? config.webRequiredVersion : config.mobileRequiredVersion;

  if (requiredVersion > 0 && version < requiredVersion) {
    return {
      message: config.requiredMessage || DEFAULT_REQUIRED_MESSAGE,
      status: "required",
      updateUrl: config.updateUrl,
    };
  }

  if (warningVersion > 0 && version < warningVersion) {
    return {
      message: config.warningMessage || DEFAULT_WARNING_MESSAGE,
      status: "warning",
      updateUrl: config.updateUrl,
    };
  }

  return {status: "ok"};
};

/**
 * TerrenoPlugin that registers the public GET /version-check endpoint.
 * Built into TerrenoApp automatically.
 */
export class VersionCheckPlugin implements TerrenoPlugin {
  register(app: express.Application): void {
    app.get(
      "/version-check",
      asyncHandler(async (req, res) => {
        const versionParam = req.query.version;
        const platformParam = req.query.platform as string | undefined;

        const version =
          typeof versionParam === "string"
            ? parseInt(versionParam, 10)
            : typeof versionParam === "number"
              ? versionParam
              : undefined;
        const platform =
          platformParam === "web" || platformParam === "mobile" ? platformParam : "web";

        if (version === undefined || Number.isNaN(version)) {
          return res.json({status: "ok" as const});
        }

        const config = await VersionConfig.findOneOrNone({});
        const result = computeVersionCheck(config ? config.toObject() : null, version, platform);
        return res.json(result);
      })
    );
  }
}
