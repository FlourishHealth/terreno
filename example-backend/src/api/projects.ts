import {modelRouter, OrganizationQueryFilter, Permissions} from "@terreno/api";
import {Project} from "../models";
import type {ProjectDocument, UserDocument} from "../types";

const getUserOrganizationIds = (user?: unknown): string[] => {
  return (user as UserDocument | undefined)?.organizationIds ?? [];
};

/**
 * Tenant-scoped sync example: every member of a project's organization shares the
 * same stream (`projects|tenant:{organizationId}`), resolved through the SyncApp's
 * `getUserScopes` callback (see server.ts).
 *
 * Access is gated by the shared `Permissions.IsOrganizationMember` (object-level tenant check) and
 * `OrganizationQueryFilter` (list scoping) from @terreno/api.
 */
export const projectRouter = modelRouter("/projects", Project, {
  permissions: {
    create: [Permissions.IsAuthenticated, Permissions.IsOrganizationMember],
    delete: [Permissions.IsAuthenticated, Permissions.IsOrganizationMember],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated, Permissions.IsOrganizationMember],
    update: [Permissions.IsAuthenticated, Permissions.IsOrganizationMember],
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
  queryFilter: OrganizationQueryFilter,
  sort: "-created",
  // Local-first sync (@terreno/syncdb): stream = projects|tenant:{organizationId}.
  sync: {scope: {field: "organizationId", type: "tenant"}},
});
