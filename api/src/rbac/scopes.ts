import type {User} from "../auth";
import type {ResourceScope, ScopeArgs} from "./types";

const getValueAtPath = (doc: unknown, path: string): unknown => {
  const parts = path.split(".");
  let current: unknown = doc;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const matchesFragment = (
  doc: unknown,
  fragment: Record<string, unknown>,
  fieldOf?: (doc: unknown, path: string) => unknown
): boolean => {
  for (const [path, expected] of Object.entries(fragment)) {
    const actual = fieldOf ? fieldOf(doc, path) : getValueAtPath(doc, path);
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const query = expected as Record<string, unknown>;
      if ("$in" in query) {
        const values = (query.$in as unknown[]).map((value) => String(value));
        if (!values.includes(String(actual))) {
          return false;
        }
        continue;
      }
      if ("$eq" in query) {
        if (String(actual) !== String(query.$eq)) {
          return false;
        }
        continue;
      }
    }
    if (String(actual) !== String(expected)) {
      return false;
    }
  }
  return true;
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
      return matchesFragment(
        args.doc,
        fragment,
        def.fieldOf as (doc: unknown, path: string) => unknown
      );
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
