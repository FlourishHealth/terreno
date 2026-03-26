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
 * TerrenoPlugin that adds a public GET /version-check endpoint for upgrade enforcement.
 * Compares client build number against admin-configured thresholds per platform.
 */
export class VersionCheckPlugin implements TerrenoPlugin {
  register(app: express.Application): void {
    app.get(
      "/version-check",
      asyncHandler(async (req, res) => {
        const versionParam = req.query.version;
        const platform = req.query.platform as string | undefined;

        const version =
          typeof versionParam === "string"
            ? parseInt(versionParam, 10)
            : typeof versionParam === "number"
              ? versionParam
              : undefined;

        if (version === undefined || Number.isNaN(version)) {
          return res.json({status: "ok" as VersionCheckStatus});
        }

        const platformNormalized = platform === "web" || platform === "mobile" ? platform : "web";

        const config = await VersionConfig.findOneOrNone({_singleton: "config"});

        if (!config) {
          return res.json({status: "ok" as VersionCheckStatus});
        }

        const requiredVersion =
          platformNormalized === "web"
            ? (config.webRequiredVersion ?? 0)
            : (config.mobileRequiredVersion ?? 0);
        const warningVersion =
          platformNormalized === "web"
            ? (config.webWarningVersion ?? 0)
            : (config.mobileWarningVersion ?? 0);

        const response: VersionCheckResponse = {
          status: "ok",
        };

        if (requiredVersion > 0 && version < requiredVersion) {
          response.status = "required";
          response.message = config.requiredMessage ?? DEFAULT_REQUIRED_MESSAGE;
          if (config.updateUrl) {
            response.updateUrl = config.updateUrl;
          }
        } else if (warningVersion > 0 && version < warningVersion) {
          response.status = "warning";
          response.message = config.warningMessage ?? DEFAULT_WARNING_MESSAGE;
          if (config.updateUrl) {
            response.updateUrl = config.updateUrl;
          }
        }

        return res.json(response);
      })
    );
  }
}
