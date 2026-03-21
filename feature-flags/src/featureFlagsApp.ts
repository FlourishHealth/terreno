import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  modelRouter,
  Permissions,
  type TerrenoPlugin,
} from "@terreno/api";
import type express from "express";
import {evaluateAllFlags} from "./evaluate";
import {FeatureFlag} from "./featureFlagModel";
import type {FeatureFlagsOptions, SegmentFunction} from "./types";

/**
 * TerrenoPlugin that provides feature flags and A/B testing.
 *
 * Creates admin CRUD endpoints for managing flags and a user-facing
 * evaluation endpoint that returns all flag values for the current user.
 *
 * @example
 * ```typescript
 * const segments = {
 *   "pro-users": (user) => user.plan === "pro",
 *   "beta-testers": (user) => user.betaTester === true,
 * };
 *
 * new TerrenoApp({ userModel: User })
 *   .register(new FeatureFlagsApp({ segments }))
 *   .start();
 * ```
 */
export class FeatureFlagsApp implements TerrenoPlugin {
  private options: FeatureFlagsOptions;
  private segments: Record<string, SegmentFunction>;

  constructor(options?: FeatureFlagsOptions) {
    this.options = options ?? {};
    this.segments = this.options.segments ?? {};
  }

  register(app: express.Application): void {
    const basePath = this.options.basePath ?? "/feature-flags";

    // Admin CRUD routes for flags
    app.use(
      `${basePath}/flags`,
      modelRouter(FeatureFlag, {
        permissions: {
          create: [Permissions.IsAdmin],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [Permissions.IsAdmin],
        },
        sort: "-created",
      })
    );

    // GET /feature-flags/evaluate — evaluate all flags for current user
    app.get(
      `${basePath}/evaluate`,
      authenticateMiddleware(),
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const user = req.user as {_id?: unknown; id?: string} | undefined;
        if (!user) {
          throw new APIError({status: 401, title: "Authentication required"});
        }

        const userId = String(user._id ?? user.id);
        const results = await evaluateAllFlags(FeatureFlag, userId, user, this.segments);

        return res.json({data: results});
      })
    );

    // GET /feature-flags/segments — list registered segment names (admin only)
    app.get(
      `${basePath}/segments`,
      authenticateMiddleware(),
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const user = req.user as {admin?: boolean} | undefined;
        if (!user?.admin) {
          throw new APIError({status: 403, title: "Only admins can view segments"});
        }

        return res.json({data: Object.keys(this.segments)});
      })
    );
  }
}
