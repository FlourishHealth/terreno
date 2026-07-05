import {modelRouter, type PermissionMethod, Permissions} from "@terreno/api";
import {Project} from "../models";
import type {ProjectDocument, UserDocument} from "../types";

const getUserOrganizationIds = (user?: unknown): string[] => {
  return (user as UserDocument | undefined)?.organizationIds ?? [];
};

/**
 * Object-level permission for tenant-scoped documents: the user must belong to the
 * project's organization (admins always pass). With no object (list/create checks)
 * it defers to the queryFilter/preCreate scoping.
 */
const IsOrganizationMember: PermissionMethod<ProjectDocument> = (_method, user, obj) => {
  if (!obj) {
    return true;
  }
  if (!user) {
    return false;
  }
  if (user.admin) {
    return true;
  }
  return getUserOrganizationIds(user).includes(obj.organizationId);
};

/**
 * Tenant-scoped sync example: every member of a project's organization shares the
 * same stream (`projects|tenant:{organizationId}`), resolved through the SyncApp's
 * `getUserScopes` callback (see server.ts).
 */
export const projectRouter = modelRouter("/projects", Project, {
  permissions: {
    create: [Permissions.IsAuthenticated, IsOrganizationMember],
    delete: [Permissions.IsAuthenticated, IsOrganizationMember],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated, IsOrganizationMember],
    update: [Permissions.IsAuthenticated, IsOrganizationMember],
  },
  preCreate: (body, req) => {
    const organizationIds = getUserOrganizationIds(req.user);
    return {
      // Default new projects into the user's first organization when unspecified.
      organizationId: organizationIds[0],
      ...body,
    } as ProjectDocument;
  },
  queryFields: ["organizationId", "title"],
  // Restrict list queries to the caller's organizations.
  queryFilter: (user) => ({organizationId: {$in: getUserOrganizationIds(user)}}),
  sort: "-created",
  // Local-first sync (@terreno/syncdb): stream = projects|tenant:{organizationId}.
  sync: {scope: {field: "organizationId", type: "tenant"}},
});
