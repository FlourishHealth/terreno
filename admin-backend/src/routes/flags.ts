import {APIError, asyncHandler, authenticateMiddleware} from "@terreno/api";
import {Router} from "express";
import type {Model} from "mongoose";
import type {AdminApp} from "../adminApp";
import {AuditLog} from "../models/auditLog";
import {FeatureFlag} from "../models/featureFlag";

const requireAdmin = (req: any) => {
  if (!req.user?.admin) {
    throw new APIError({status: 403, title: "Admin access required"});
  }
};

const requireAuth = (req: any) => {
  if (!req.user?._id) {
    throw new APIError({status: 401, title: "Authentication required"});
  }
};

export const createFlagRoutes = (adminApp: AdminApp, userModel: Model<any>): Router => {
  const router = Router();

  // GET /flags/me — MUST be registered before /:key to avoid Express treating "me" as a key
  router.get(
    "/me",
    authenticateMiddleware(),
    asyncHandler(async (req: any, res: any) => {
      requireAuth(req);
      const flags = await adminApp.allFlags(req.user);
      return res.json(flags);
    })
  );

  // GET /flags — list all flags (admin only)
  router.get(
    "/",
    authenticateMiddleware(),
    asyncHandler(async (req: any, res: any) => {
      requireAdmin(req);
      const query: any = {};
      if (req.query.status) {
        query.status = req.query.status;
      }
      const flags = await FeatureFlag.find(query).sort("-created");
      return res.json({data: flags});
    })
  );

  // GET /flags/:key — get a single flag by key (admin only)
  router.get(
    "/:key",
    authenticateMiddleware(),
    asyncHandler(async (req: any, res: any) => {
      requireAdmin(req);
      const flag = await FeatureFlag.findOne({key: req.params.key});
      if (!flag) {
        throw new APIError({status: 404, title: "Flag not found"});
      }
      return res.json(flag);
    })
  );

  // PATCH /flags/:key — update flag (admin only)
  router.patch(
    "/:key",
    authenticateMiddleware(),
    asyncHandler(async (req: any, res: any) => {
      requireAdmin(req);
      const flag = await FeatureFlag.findOne({key: req.params.key});
      if (!flag) {
        throw new APIError({status: 404, title: "Flag not found"});
      }

      const allowedFields = ["enabled", "globalValue"];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          await AuditLog.create({
            action: "update",
            field,
            newValue: req.body[field],
            previousValue: (flag as any)[field],
            resourceKey: flag.key,
            resourceType: "feature_flag",
            userId: req.user._id,
          });
          (flag as any)[field] = req.body[field];
        }
      }

      await flag.save();
      await adminApp.refreshFlagCache();
      return res.json(flag);
    })
  );

  // GET /flags/:key/users — list users with overrides for this flag (admin only)
  router.get(
    "/:key/users",
    authenticateMiddleware(),
    asyncHandler(async (req: any, res: any) => {
      requireAdmin(req);
      const flag = await FeatureFlag.findOne({key: req.params.key});
      if (!flag) {
        throw new APIError({status: 404, title: "Flag not found"});
      }

      const users = await userModel
        .find({[`featureFlags.${req.params.key}`]: {$exists: true}})
        .limit(200);

      const result = users.map((user: any) => ({
        _id: user._id,
        email: user.email,
        name: user.name,
        overrideValue: user.featureFlags?.get(req.params.key),
      }));

      return res.json({data: result});
    })
  );

  // PUT /flags/:key/users/:userId — set a user's override for this flag (admin only)
  router.put(
    "/:key/users/:userId",
    authenticateMiddleware(),
    asyncHandler(async (req: any, res: any) => {
      requireAdmin(req);
      const flag = await FeatureFlag.findOne({key: req.params.key});
      if (!flag) {
        throw new APIError({status: 404, title: "Flag not found"});
      }

      const targetUser = await userModel.findById(req.params.userId);
      if (!targetUser) {
        throw new APIError({status: 404, title: "User not found"});
      }

      const previousValue = targetUser.featureFlags?.get(req.params.key);

      if (!targetUser.featureFlags) {
        targetUser.featureFlags = new Map();
      }
      targetUser.featureFlags.set(req.params.key, req.body.value);
      await targetUser.save();

      await AuditLog.create({
        action: "set_override",
        field: "featureFlags",
        newValue: req.body.value,
        previousValue,
        resourceKey: flag.key,
        resourceType: "feature_flag",
        targetUserId: targetUser._id,
        userId: req.user._id,
      });

      return res.json({
        _id: targetUser._id,
        email: targetUser.email,
        name: targetUser.name,
        overrideValue: req.body.value,
      });
    })
  );

  // DELETE /flags/:key/users/:userId — remove a user's override for this flag (admin only)
  router.delete(
    "/:key/users/:userId",
    authenticateMiddleware(),
    asyncHandler(async (req: any, res: any) => {
      requireAdmin(req);
      const flag = await FeatureFlag.findOne({key: req.params.key});
      if (!flag) {
        throw new APIError({status: 404, title: "Flag not found"});
      }

      const targetUser = await userModel.findById(req.params.userId);
      if (!targetUser) {
        throw new APIError({status: 404, title: "User not found"});
      }

      const previousValue = targetUser.featureFlags?.get(req.params.key);

      if (targetUser.featureFlags) {
        targetUser.featureFlags.delete(req.params.key);
        await targetUser.save();
      }

      await AuditLog.create({
        action: "remove_override",
        field: "featureFlags",
        newValue: undefined,
        previousValue,
        resourceKey: flag.key,
        resourceType: "feature_flag",
        targetUserId: targetUser._id,
        userId: req.user._id,
      });

      return res.json({success: true});
    })
  );

  return router;
};
