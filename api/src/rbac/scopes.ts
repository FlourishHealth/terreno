import type {User} from "../auth";
import {matchesQuery} from "../realtime/queryMatcher";
import type {ResourceScope, ScopeArgs} from "./types";

const projectDocForFieldOf = <TDoc>(
  doc: TDoc,
  fragment: Record<string, unknown>,
  fieldOf: (doc: TDoc, path: string) => unknown
): Record<string, unknown> => {
  const projected: Record<string, unknown> = {};
  for (const path of Object.keys(fragment)) {
    projected[path] = fieldOf(doc, path);
  }
  return projected;
};

export interface ScopeDefinition<TDoc> {
  matches: (
    args: ScopeArgs<TDoc>
  ) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  adminBypass?: (args: ScopeArgs<TDoc>) => boolean | Promise<boolean>;
  fieldOf?: (doc: TDoc, path: string) => unknown;
}

export const defineScope = <TDoc>(def: ScopeDefinition<TDoc>): ResourceScope<TDoc> => {
  return {
    check: async (args) => {
      if (def.adminBypass && (await def.adminBypass(args))) {
        return true;
      }
      const fragment = await def.matches(args);
      if (!fragment) {
        return false;
      }
      if (!args.doc) {
        return true;
      }
      const subject = def.fieldOf
        ? projectDocForFieldOf(args.doc as TDoc, fragment, def.fieldOf)
        : (args.doc as Record<string, unknown>);
      return matchesQuery(subject, fragment);
    },
    filter: async (args) => {
      if (def.adminBypass && (await def.adminBypass(args))) {
        return {};
      }
      return def.matches(args);
    },
  };
};

export interface OwnerScopeOptions {
  field?: string;
  adminBypass?: (args: {user?: User}) => boolean | Promise<boolean>;
}

const defaultAdminBypass = ({user}: {user?: User}): boolean => {
  const withRoles = user as (User & {roles?: string[]}) | undefined;
  if (user?.admin) {
    return true;
  }
  return Boolean(withRoles?.roles?.includes("superadmin"));
};

export const OwnerScope = (options: string | OwnerScopeOptions = {}): ResourceScope => {
  const {field = "ownerId", adminBypass = defaultAdminBypass} =
    typeof options === "string" ? {field: options} : options;

  return defineScope<unknown>({
    adminBypass: (args) => adminBypass({user: args.user}),
    fieldOf: (doc, path) => {
      if (path !== field) {
        return undefined;
      }
      const owner = (doc as Record<string, unknown> | undefined)?.[field];
      const ownerId = (owner as {_id?: unknown} | null | undefined)?._id ?? owner;
      return ownerId == null ? undefined : String(ownerId);
    },
    matches: ({user}) => (user ? {[field]: user.id} : null),
  });
};
