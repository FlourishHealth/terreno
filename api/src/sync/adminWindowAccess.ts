import type {User} from "../auth";
import {Permissions} from "../permissions";
import {ADMIN_PAGE_PERMISSION} from "../rbac/statements";
import type {AnyTerrenoAccess} from "../rbac/types";

/**
 * Gate for `{collection}|admin` window subscribe and cross-owner `GET /sync/entities`.
 *
 * Matches the admin UI shell: with `accessControl`, require `admin:access`.
 * Without RBAC, fall back to the legacy `user.admin` flag.
 */
export const canUseAdminBroadcastWindow = async ({
  accessControl,
  canOpenAdminWindow,
  user,
}: {
  accessControl?: AnyTerrenoAccess;
  canOpenAdminWindow?: (user: User) => boolean | Promise<boolean>;
  user: User;
}): Promise<boolean> => {
  if (canOpenAdminWindow) {
    return Boolean(await canOpenAdminWindow(user));
  }
  if (accessControl) {
    const result = await accessControl.can({
      permissions: {admin: [...ADMIN_PAGE_PERMISSION.admin]},
      user,
    });
    return result.allowed;
  }
  return Permissions.IsAdmin("list", user);
};
