import type {User} from "../auth";
import {BadRequestError} from "../errors";
import type {PermissionMethod} from "../permissions";
import {Membership} from "./organizationModel";
import {getOrgContext, isPlatformOrgActor} from "./orgContext";

export const OrgQueryFilter = (
  _user?: User,
  _query?: Record<string, unknown>
): Record<string, unknown> => {
  const context = getOrgContext();
  if (!context?.organization) {
    throw new BadRequestError("Organization context required");
  }
  return {organizationId: context.organization._id};
};

export const isOrgMemberPermission: PermissionMethod<unknown> = async (_method, user, obj) => {
  if (!obj) {
    return true;
  }
  if (!user) {
    return false;
  }
  const organizationId = (obj as {organizationId?: unknown}).organizationId;
  if (!organizationId) {
    return false;
  }
  if (isPlatformOrgActor(user)) {
    const context = getOrgContext();
    if (!context?.organization) {
      return false;
    }
    return String(context.organization._id) === String(organizationId);
  }
  return Membership.isMember(user.id, String(organizationId));
};
