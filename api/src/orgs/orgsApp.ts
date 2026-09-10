import type express from "express";
import {type Application, Router} from "express";

import {asyncHandler} from "../api";
import {authenticateMiddleware, type User, type UserModel} from "../auth";
import {APIError, ConflictError, ForbiddenError, NotFoundError} from "../errors";
import {logger} from "../logger";
import {createOpenApiBuilder} from "../openApiBuilder";
import type {AnyTerrenoAccess} from "../rbac/types";
import type {TerrenoPlugin} from "../terrenoPlugin";
import type {MembershipDocument} from "../types/membership";
import type {OrganizationDocument} from "../types/organization";
import {Membership, Organization, organizationSlugFromName} from "./organizationModel";
import {isPlatformOrgActor, runWithOrgContext} from "./orgContext";

export interface OrgAuditEvent {
  actorId?: string;
  organizationId?: string;
  organizationLabel?: string;
  verb:
    | "created"
    | "updated"
    | "disabled"
    | "deleted"
    | "memberAttached"
    | "memberUpdated"
    | "memberRemoved";
}

export interface OrgsAppOptions {
  access: AnyTerrenoAccess;
  basePath?: string;
  onOrgAudit?: (event: OrgAuditEvent, req: express.Request) => void | Promise<void>;
  userModel: UserModel;
}

const pathParam = (value: string | string[] | undefined, title: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new APIError({status: 400, title});
  }
  return value;
};

const userIdOf = (user: User): string => {
  if (user._id) {
    return String(user._id);
  }
  return user.id;
};

const requireUser = (req: express.Request): User => {
  const user = req.user as User | undefined;
  if (!user?.id) {
    throw new APIError({status: 401, title: "Unauthorized"});
  }
  return user;
};

const emitOrgAudit = async (args: {
  event: OrgAuditEvent;
  onOrgAudit?: OrgsAppOptions["onOrgAudit"];
  req: express.Request;
}): Promise<void> => {
  if (!args.onOrgAudit) {
    return;
  }
  try {
    await args.onOrgAudit(args.event, args.req);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`onOrgAudit failed after ${args.event.verb}: ${detail}`);
  }
};

const loadOrganization = async (id: string): Promise<OrganizationDocument> => {
  const organization = await Organization.findOneOrNone({_id: id});
  if (!organization) {
    throw new NotFoundError("Organization not found");
  }
  return organization;
};

const loadActiveMembership = async (
  user: User,
  organizationId: OrganizationDocument["_id"]
): Promise<MembershipDocument | undefined> => {
  const membership = await Membership.findOneOrNone({
    organizationId,
    status: "active",
    userId: userIdOf(user),
  });
  return membership ?? undefined;
};

const countActiveOrgAdmins = async (
  organizationId: OrganizationDocument["_id"]
): Promise<number> => {
  return Membership.countDocuments({
    organizationId,
    roleName: "org-admin",
    status: "active",
  });
};

const assertNotLastOrgAdmin = async (
  membership: MembershipDocument,
  nextRoleName?: string,
  nextStatus?: string
): Promise<void> => {
  const remainsOrgAdmin =
    (nextRoleName ?? membership.roleName) === "org-admin" &&
    (nextStatus ?? membership.status) === "active";
  if (remainsOrgAdmin) {
    return;
  }
  if (membership.roleName !== "org-admin" || membership.status !== "active") {
    return;
  }
  const activeAdmins = await countActiveOrgAdmins(membership.organizationId);
  if (activeAdmins <= 1) {
    throw new APIError({status: 400, title: "Cannot remove the last org-admin"});
  }
};

const assertCan = async (args: {
  access: AnyTerrenoAccess;
  organization?: OrganizationDocument;
  permissions: {organization: string[]};
  user: User;
}): Promise<void> => {
  const result = await args.access.can({
    doc: args.organization,
    permissions: args.permissions,
    user: args.user,
  });
  if (result.allowed) {
    return;
  }
  throw new ForbiddenError(result.reason ?? "Access denied");
};

export class OrgsApp implements TerrenoPlugin {
  private readonly access: AnyTerrenoAccess;
  private readonly basePath: string;
  private readonly onOrgAudit?: OrgsAppOptions["onOrgAudit"];
  private readonly userModel: UserModel;

  constructor(options: OrgsAppOptions) {
    this.access = options.access;
    this.basePath = options.basePath ?? "/orgs";
    this.onOrgAudit = options.onOrgAudit;
    this.userModel = options.userModel;
  }

  register(app: Application, openApi?: unknown): void {
    const router = Router();
    const docs = (summary: string) =>
      createOpenApiBuilder({openApi}).withTags(["organizations"]).withSummary(summary).build();

    router.post(
      "/",
      authenticateMiddleware(),
      this.access.middleware({organization: ["create"]}),
      docs("Create an organization"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
        if (!name) {
          throw new APIError({status: 400, title: "name is required"});
        }
        const organization = await Organization.create({
          name,
          ownerId: userIdOf(user),
          settings: req.body?.settings,
        });
        await emitOrgAudit({
          event: {
            actorId: user.id,
            organizationId: String(organization._id),
            organizationLabel: organization.name,
            verb: "created",
          },
          onOrgAudit: this.onOrgAudit,
          req,
        });
        return res.status(201).json({data: organization});
      })
    );

    router.get(
      "/",
      authenticateMiddleware(),
      this.access.middleware({organization: ["list"]}),
      docs("List all organizations"),
      asyncHandler(async (_req, res) => {
        const organizations = await Organization.find({}).sort({name: 1});
        return res.json({data: organizations});
      })
    );

    router.get(
      "/mine",
      authenticateMiddleware(),
      docs("List organizations the caller may switch into"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        if (isPlatformOrgActor(user)) {
          const organizations = await Organization.find({}).sort({name: 1});
          return res.json({data: organizations});
        }
        const memberships = await Membership.find({
          roleName: "org-admin",
          status: "active",
          userId: userIdOf(user),
        });
        if (memberships.length === 0) {
          throw new ForbiddenError("Access denied");
        }
        const organizations = await Organization.find({
          _id: {$in: memberships.map((membership) => membership.organizationId)},
        }).sort({name: 1});
        return res.json({data: organizations});
      })
    );

    router.get(
      "/:id",
      authenticateMiddleware(),
      docs("Read an organization"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const organization = await loadOrganization(pathParam(req.params.id, "id is required"));
        const membership = await loadActiveMembership(user, organization._id);
        await runWithOrgContext({membership, organization}, () =>
          assertCan({
            access: this.access,
            organization,
            permissions: {organization: ["read"]},
            user,
          })
        );
        return res.json({data: organization});
      })
    );

    router.patch(
      "/:id",
      authenticateMiddleware(),
      docs("Update an organization"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const organization = await loadOrganization(pathParam(req.params.id, "id is required"));
        const membership = await loadActiveMembership(user, organization._id);
        const body = req.body ?? {};
        const wantsDisable =
          Object.hasOwn(body, "disabled") && Boolean(body.disabled) && !organization.disabled;

        await runWithOrgContext({membership, organization}, async () => {
          await assertCan({
            access: this.access,
            organization,
            permissions: {organization: ["update"]},
            user,
          });
          if (wantsDisable) {
            await assertCan({
              access: this.access,
              organization,
              permissions: {organization: ["disable"]},
              user,
            });
          }
        });

        if (typeof body.name === "string" && body.name.trim()) {
          organization.name = body.name.trim();
          organization.slug = organizationSlugFromName(organization.name);
        }
        if (Object.hasOwn(body, "settings")) {
          organization.settings = body.settings;
        }
        if (Object.hasOwn(body, "disabled")) {
          organization.disabled = Boolean(body.disabled);
        }
        await organization.save();
        if (wantsDisable) {
          await Membership.updateMany({organizationId: organization._id}, {status: "suspended"});
        }

        await emitOrgAudit({
          event: {
            actorId: user.id,
            organizationId: String(organization._id),
            organizationLabel: organization.name,
            verb: wantsDisable ? "disabled" : "updated",
          },
          onOrgAudit: this.onOrgAudit,
          req,
        });
        return res.json({data: organization});
      })
    );

    router.delete(
      "/:id",
      authenticateMiddleware(),
      this.access.middleware({organization: ["delete"]}),
      docs("Soft-delete an organization"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const organization = await loadOrganization(pathParam(req.params.id, "id is required"));
        organization.deleted = true;
        await organization.save();
        await Membership.updateMany({organizationId: organization._id}, {status: "suspended"});
        await emitOrgAudit({
          event: {
            actorId: user.id,
            organizationId: String(organization._id),
            organizationLabel: organization.name,
            verb: "deleted",
          },
          onOrgAudit: this.onOrgAudit,
          req,
        });
        return res.status(204).send();
      })
    );

    router.get(
      "/:id/members",
      authenticateMiddleware(),
      docs("List organization members"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const organization = await loadOrganization(pathParam(req.params.id, "id is required"));
        const membership = await loadActiveMembership(user, organization._id);
        await runWithOrgContext({membership, organization}, () =>
          assertCan({
            access: this.access,
            organization,
            permissions: {organization: ["manageMembers"]},
            user,
          })
        );
        const members = await Membership.find({organizationId: organization._id})
          .sort({created: 1})
          .populate({path: "userId", select: "email name"});
        return res.json({data: members});
      })
    );

    router.post(
      "/:id/members",
      authenticateMiddleware(),
      docs("Attach an existing user as a member"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const organization = await loadOrganization(pathParam(req.params.id, "id is required"));
        const actorMembership = await loadActiveMembership(user, organization._id);
        await runWithOrgContext({membership: actorMembership, organization}, () =>
          assertCan({
            access: this.access,
            organization,
            permissions: {organization: ["manageMembers"]},
            user,
          })
        );
        const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
        const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
        let target: User | null = null;
        if (email) {
          target = (await this.userModel.findOne({email})) as User | null;
        } else if (userId) {
          target = (await this.userModel.findById(userId)) as User | null;
        } else {
          throw new APIError({status: 400, title: "email or userId is required"});
        }
        if (!target) {
          throw new NotFoundError("User not found");
        }
        const existing = await Membership.findOneOrNone({
          organizationId: organization._id,
          userId: userIdOf(target),
        });
        if (existing) {
          throw new ConflictError("User is already a member");
        }
        const roleName = req.body?.roleName === "org-admin" ? "org-admin" : "member";
        const created = await Membership.create({
          organizationId: organization._id,
          roleName,
          userId: userIdOf(target),
        });
        await emitOrgAudit({
          event: {
            actorId: user.id,
            organizationId: String(organization._id),
            organizationLabel: organization.name,
            verb: "memberAttached",
          },
          onOrgAudit: this.onOrgAudit,
          req,
        });
        return res.status(201).json({data: created});
      })
    );

    router.patch(
      "/:id/members/:memberId",
      authenticateMiddleware(),
      docs("Update a membership"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const organization = await loadOrganization(pathParam(req.params.id, "id is required"));
        const actorMembership = await loadActiveMembership(user, organization._id);
        await runWithOrgContext({membership: actorMembership, organization}, () =>
          assertCan({
            access: this.access,
            organization,
            permissions: {organization: ["manageMembers"]},
            user,
          })
        );
        const member = await Membership.findOneOrNone({
          _id: pathParam(req.params.memberId, "memberId is required"),
          organizationId: organization._id,
        });
        if (!member) {
          throw new NotFoundError("Membership not found");
        }
        const nextRoleName =
          typeof req.body?.roleName === "string" ? req.body.roleName : member.roleName;
        const nextStatus = typeof req.body?.status === "string" ? req.body.status : member.status;
        await assertNotLastOrgAdmin(member, nextRoleName, nextStatus);
        if (typeof req.body?.roleName === "string") {
          member.roleName = req.body.roleName === "org-admin" ? "org-admin" : "member";
        }
        if (typeof req.body?.status === "string") {
          member.status = req.body.status === "suspended" ? "suspended" : "active";
        }
        await member.save();
        await emitOrgAudit({
          event: {
            actorId: user.id,
            organizationId: String(organization._id),
            organizationLabel: organization.name,
            verb: "memberUpdated",
          },
          onOrgAudit: this.onOrgAudit,
          req,
        });
        return res.json({data: member});
      })
    );

    router.delete(
      "/:id/members/:memberId",
      authenticateMiddleware(),
      docs("Remove a membership"),
      asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const organization = await loadOrganization(pathParam(req.params.id, "id is required"));
        const actorMembership = await loadActiveMembership(user, organization._id);
        await runWithOrgContext({membership: actorMembership, organization}, () =>
          assertCan({
            access: this.access,
            organization,
            permissions: {organization: ["manageMembers"]},
            user,
          })
        );
        const member = await Membership.findOneOrNone({
          _id: pathParam(req.params.memberId, "memberId is required"),
          organizationId: organization._id,
        });
        if (!member) {
          throw new NotFoundError("Membership not found");
        }
        await assertNotLastOrgAdmin(member, "member", "suspended");
        await member.deleteOne();
        await emitOrgAudit({
          event: {
            actorId: user.id,
            organizationId: String(organization._id),
            organizationLabel: organization.name,
            verb: "memberRemoved",
          },
          onOrgAudit: this.onOrgAudit,
          req,
        });
        return res.status(204).send();
      })
    );

    app.use(this.basePath, router);
  }
}
