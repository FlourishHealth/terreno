import {APIError, modelRouter, OrganizationQueryFilter, Permissions} from "@terreno/api";
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
    // D3: spread body FIRST so a caller-supplied organizationId can never win by
    // ordering, then force/validate it belongs to one of the caller's organizations.
    // Without this, a client could POST an arbitrary organizationId and create a
    // document in a tenant it does not belong to (a tenant create-escape).
    const requested = (body as Partial<ProjectDocument>)?.organizationId;
    const organizationId = requested ?? organizationIds[0];
    if (!organizationId || !organizationIds.includes(organizationId)) {
      throw new APIError({
        status: 403,
        title: "organizationId must be one of the caller's organizations",
      });
    }
    return {
      ...body,
      organizationId,
    } as ProjectDocument;
  },
  queryFields: ["organizationId", "title"],
  // Restrict list queries to the caller's organizations.
  queryFilter: OrganizationQueryFilter,
  sort: "-created",
  // Local-first sync (@terreno/syncdb): stream = projects|tenant:{organizationId}.
  sync: {scope: {field: "organizationId", type: "tenant"}},
});
