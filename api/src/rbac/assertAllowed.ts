import type {ModelRouterOptions, RESTMethod} from "../api";
import type {User} from "../auth";
import {APIError} from "../errors";
import {checkPermissions, type PermissionMethod} from "../permissions";
import {resolveActionForMethod} from "./modelRouterAccess";
import type {AnyTerrenoAccess, ModelRouterAccessOptions} from "./types";

export interface AssertAllowedArgs<T> {
  method: RESTMethod;
  options: Pick<ModelRouterOptions<T>, "access" | "accessControl" | "permissions">;
  user?: User;
  doc?: T;
}

const throwAccessDenied = ({
  status,
  title,
  detail,
}: {
  status: 403 | 405;
  title: string;
  detail?: string;
}): void => {
  throw new APIError({
    detail,
    status,
    title,
  });
};

const assertAllowedViaAccess = async <T>({
  method,
  access,
  accessControl,
  user,
  doc,
}: {
  method: RESTMethod;
  access: ModelRouterAccessOptions;
  accessControl: AnyTerrenoAccess;
  user?: User;
  doc?: T;
}): Promise<void> => {
  const statements = accessControl.statements as Record<string, readonly string[]>;
  const action = resolveActionForMethod(method, access, statements);
  if (!action) {
    throwAccessDenied({status: 405, title: "Method not allowed"});
  }

  const result = await accessControl.can({
    doc,
    permissions: {[access.resource]: [action]} as never,
    user,
  });
  if (!result.allowed) {
    throwAccessDenied({
      detail: result.reason,
      status: 403,
      title: "Access denied",
    });
  }

  if (access.scope?.check && user) {
    const scopeResult = await access.scope.check({
      action,
      doc,
      user,
    });
    if (scopeResult === false) {
      throwAccessDenied({status: 403, title: "Access denied"});
    }
    if (scopeResult && typeof scopeResult === "object") {
      const extra = await accessControl.can({
        doc,
        permissions: scopeResult as never,
        user,
      });
      if (!extra.allowed) {
        throwAccessDenied({
          detail: extra.reason,
          status: 403,
          title: "Access denied",
        });
      }
    }
  }

  const also = access.also?.[method] ?? [];
  if (also.length > 0) {
    const alsoAllowed = await checkPermissions(method, also as PermissionMethod<T>[], user, doc);
    if (!alsoAllowed) {
      throwAccessDenied({
        status: doc ? 403 : 405,
        title: doc ? "Access denied" : "Method not allowed",
      });
    }
  }
};

const assertAllowedViaPermissions = async <T>({
  method,
  permissions,
  user,
  doc,
}: {
  method: RESTMethod;
  permissions: PermissionMethod<T>[];
  user?: User;
  doc?: T;
}): Promise<void> => {
  if (permissions.length === 0) {
    throwAccessDenied({status: 405, title: "Method not allowed"});
  }

  const allowed = await checkPermissions(method, permissions, user, doc);
  if (!allowed) {
    throwAccessDenied({
      status: doc ? 403 : 405,
      title: doc ? "Access denied" : "Method not allowed",
    });
  }
};

export const assertAllowed = async <T>({
  method,
  options,
  user,
  doc,
}: AssertAllowedArgs<T>): Promise<void> => {
  if (options.access && options.accessControl) {
    await assertAllowedViaAccess({
      access: options.access,
      accessControl: options.accessControl,
      doc,
      method,
      user,
    });
    return;
  }

  if (!options.permissions) {
    throw new Error("modelRouter requires permissions or access with accessControl");
  }

  await assertAllowedViaPermissions({
    doc,
    method,
    permissions: options.permissions[method],
    user,
  });
};
