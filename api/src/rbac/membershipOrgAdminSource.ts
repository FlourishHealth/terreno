import type {User} from "../auth";
import {Membership} from "../orgs/organizationModel";
import {getOrgContext} from "../orgs/orgContext";
import type {PermissionSet} from "./statements";
import type {PermissionSource, PermissionSourceGrants} from "./types";

export const MEMBERSHIP_ORG_ADMIN_PERMISSION_SOURCE_NAME = "membership-org-admin";

/** Grants applied when `Membership.roleName` is `org-admin` in the current org context. */
export const ORG_ADMIN_PERMISSION_BUNDLE: PermissionSet = {
  admin: ["access"],
  organization: ["read", "update", "manageMembers"],
};

const userIdForMembershipLookup = (user: User): string => {
  if (user._id) {
    return String(user._id);
  }
  return user.id;
};

const isActiveOrgAdminMembership = (membership?: {roleName?: string; status?: string}): boolean => {
  return membership?.roleName === "org-admin" && membership.status === "active";
};

const fullOrgAdminGrants = (): PermissionSourceGrants => ({
  permissions: {
    admin: [...ORG_ADMIN_PERMISSION_BUNDLE.admin],
    organization: [...ORG_ADMIN_PERMISSION_BUNDLE.organization],
  },
});

const shellOnlyOrgAdminGrants = (): PermissionSourceGrants => ({
  permissions: {
    admin: [...ORG_ADMIN_PERMISSION_BUNDLE.admin],
  },
});

export const membershipOrgAdminPermissionSource = (): PermissionSource => ({
  getGrants: async ({user}): Promise<PermissionSourceGrants | null> => {
    const contextMembership = getOrgContext()?.membership;
    if (contextMembership) {
      if (!isActiveOrgAdminMembership(contextMembership)) {
        return null;
      }
      return fullOrgAdminGrants();
    }

    const activeMemberships = await Membership.findActiveForUser(userIdForMembershipLookup(user));
    const hasOrgAdminMembership = activeMemberships.some((row) => row.roleName === "org-admin");
    if (!hasOrgAdminMembership) {
      return null;
    }

    return shellOnlyOrgAdminGrants();
  },
  name: MEMBERSHIP_ORG_ADMIN_PERMISSION_SOURCE_NAME,
  ttlMs: 0,
});
