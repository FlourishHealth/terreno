/**
 * Admin UI v2 helpers and constants (Django-parity config contract).
 * @see docs/implementationPlans/admin-ui-v2-django-parity.md
 */

export const ADMIN_SCHEMA_VERSION = 2;

export const MAX_BULK_PATCH_IDS = 1000;

export const SYSTEM_ADMIN_FIELDS = new Set(["_id", "id", "__v", "created", "updated", "deleted"]);

export interface AdminHomeSlotsInput {
  contentTop?: string[];
  main?: string[];
  navGlobal?: string[];
  sidebar?: string[];
}

export interface AdminHomeInput {
  slots?: AdminHomeSlotsInput;
  title?: string;
  /** Legacy: widget ids treated as main column when slots omitted */
  widgets?: string[];
}

export interface AdminHomeNormalized {
  slots: {
    contentTop?: string[];
    main?: string[];
    navGlobal?: string[];
    sidebar?: string[];
  };
  title: string;
}

export const normalizeSidebarRecentLast = (sidebar?: string[]): string[] | undefined => {
  if (!sidebar || sidebar.length === 0) {
    return sidebar;
  }
  if (!sidebar.includes("recentActivity")) {
    return sidebar;
  }
  const without = sidebar.filter((id) => id !== "recentActivity");
  return [...without, "recentActivity"];
};

export const normalizeAdminHome = (home?: AdminHomeInput): AdminHomeNormalized => {
  const title = home?.title ?? "Administration";
  if (home?.slots) {
    return {
      slots: {
        ...home.slots,
        sidebar: normalizeSidebarRecentLast(home.slots.sidebar),
      },
      title,
    };
  }
  if (home?.widgets && home.widgets.length > 0) {
    const main = home.widgets.includes("modelsGrid")
      ? [...home.widgets]
      : ["modelsGrid", ...home.widgets];
    return {
      slots: {main},
      title,
    };
  }
  return {
    slots: {main: ["modelsGrid"]},
    title,
  };
};

export interface AdminListFilterBoolean {
  field: string;
  kind: "boolean";
  label?: string;
}

export interface AdminListFilterChoice {
  choices: {label: string; value: string}[];
  field: string;
  kind: "choice";
  label?: string;
}

export interface AdminListFilterDateRange {
  field: string;
  kind: "dateRange";
  label?: string;
}

export interface AdminListFilterRef {
  field: string;
  kind: "ref";
  label?: string;
  refModel?: string;
}

export interface AdminListFilterText {
  field: string;
  kind: "text";
  label?: string;
}

export type AdminListFilter =
  | AdminListFilterBoolean
  | AdminListFilterChoice
  | AdminListFilterDateRange
  | AdminListFilterRef
  | AdminListFilterText;

/** Inputs shared by admin config and {@link buildAdminModelQueryFields}. */
export interface AdminModelQueryFieldSource {
  filters?: AdminListFilter[];
  listDisplay?: string[];
  listFields: string[];
  searchFields?: string[];
}

/**
 * Derives `modelRouter` `queryFields` from admin UI v2 list metadata so changelist
 * filters and sort keys match allowed query parameters on `GET` list routes.
 */
export const buildAdminModelQueryFields = (config: AdminModelQueryFieldSource): string[] => {
  const fields = new Set<string>(["_id"]);
  for (const name of config.listFields) {
    fields.add(name);
  }
  for (const name of config.listDisplay ?? []) {
    fields.add(name);
  }
  for (const name of config.searchFields ?? []) {
    fields.add(name);
  }
  for (const filter of config.filters ?? []) {
    fields.add(filter.field);
    if (filter.kind === "dateRange") {
      fields.add(`${filter.field}_gte`);
      fields.add(`${filter.field}_lte`);
    }
  }
  return [...fields];
};

export interface AdminFieldsetInput {
  fields: string[];
  title: string;
}

export interface AdminActionInput {
  background?: boolean;
  confirm?: string;
  id: string;
  label: string;
  /** Keys allowed for synchronous bulk-patch actions */
  patchKeys?: string[];
}

export interface AdminModelPermissionsInput {
  create?: boolean;
  delete?: boolean;
  update?: boolean;
}

export const defaultBulkPatchAllowlistFrom = (params: {
  hiddenFieldSet: Set<string>;
  listFields: string[];
  readonlyFields: string[];
  schemaPaths: Set<string>;
}): string[] => {
  const out: string[] = [];
  for (const field of params.listFields) {
    if (SYSTEM_ADMIN_FIELDS.has(field)) {
      continue;
    }
    if (params.hiddenFieldSet.has(field)) {
      continue;
    }
    if (params.readonlyFields.includes(field)) {
      continue;
    }
    if (!params.schemaPaths.has(field)) {
      continue;
    }
    out.push(field);
  }
  return out;
};
