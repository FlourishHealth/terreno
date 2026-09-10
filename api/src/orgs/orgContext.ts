import {AsyncLocalStorage} from "node:async_hooks";
import type express from "express";
import type {NextFunction, RequestHandler} from "express";

import type {User} from "../auth";
import {APIError, BadRequestError, ForbiddenError, NotFoundError} from "../errors";
import type {MembershipDocument} from "../types/membership";
import type {OrganizationDocument} from "../types/organization";
import {isValidObjectId} from "../utils";
import {Membership, Organization} from "./organizationModel";

export const ORGANIZATION_ID_HEADER = "x-organization-id";

export const PLATFORM_ORG_ROLE_NAMES = ["operator", "superadmin"] as const;

export interface ResolvedOrgContext {
  membership?: MembershipDocument;
  organization?: OrganizationDocument;
}

const orgContextAls = new AsyncLocalStorage<ResolvedOrgContext>();

export const getOrgContext = (): ResolvedOrgContext | undefined => {
  return orgContextAls.getStore();
};

export const runWithOrgContext = <T>(context: ResolvedOrgContext, fn: () => T): T => {
  return orgContextAls.run(context, fn);
};

export const isPlatformOrgActor = (user?: User): boolean => {
  if (!user) {
    return false;
  }
  const roles = (user as User & {roles?: string[]}).roles ?? [];
  return roles.includes("operator") || roles.includes("superadmin");
};

const readOrganizationIdHeader = (req: express.Request): string | undefined => {
  const raw = req.header("X-Organization-Id");
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
};

const userIdForMembership = (user: User): string => {
  if (user._id) {
    return String(user._id);
  }
  return user.id;
};

const loadOrganization = async (id: string): Promise<OrganizationDocument> => {
  if (!isValidObjectId(id)) {
    throw new BadRequestError("Invalid organization id");
  }
  const organization = await Organization.findOneOrNone({_id: id});
  if (!organization) {
    throw new NotFoundError("Organization not found");
  }
  return organization;
};

export const resolveOrgContext = async (args: {
  organizationId?: string;
  required: boolean;
  user?: User;
}): Promise<ResolvedOrgContext> => {
  const user = args.user;
  if (!user?.id) {
    if (args.required) {
      throw new APIError({status: 401, title: "Unauthorized"});
    }
    return {};
  }

  const platform = isPlatformOrgActor(user);

  if (args.organizationId) {
    const organization = await loadOrganization(args.organizationId);
    const membership = await Membership.findOneOrNone({
      organizationId: organization._id,
      status: "active",
      userId: userIdForMembership(user),
    });
    if (!platform && !membership) {
      throw new ForbiddenError("Not a member of this organization");
    }
    return {membership: membership ?? undefined, organization};
  }

  if (!args.required) {
    return {};
  }

  if (platform) {
    throw new BadRequestError("Organization context required");
  }

  const active = await Membership.findActiveForUser(userIdForMembership(user));
  const adminMemberships = active.filter((row) => {
    return row.roleName === "org-admin";
  });
  if (adminMemberships.length === 1) {
    const membership = adminMemberships[0];
    if (!membership) {
      throw new ForbiddenError("Organization context required");
    }
    const organization = await Organization.findExactlyOne({_id: membership.organizationId});
    return {membership, organization};
  }
  if (adminMemberships.length > 1) {
    throw new BadRequestError("Select an organization");
  }
  throw new ForbiddenError("Organization context required");
};

export const orgContextMiddleware = (options?: {required?: boolean}): RequestHandler => {
  const required = options?.required ?? false;
  return async (req: express.Request, _res: express.Response, next: NextFunction) => {
    try {
      const context = await resolveOrgContext({
        organizationId: readOrganizationIdHeader(req),
        required,
        user: req.user,
      });
      req.organization = context.organization;
      req.membership = context.membership;
      orgContextAls.run(context, () => {
        next();
      });
    } catch (error) {
      next(error);
    }
  };
};
