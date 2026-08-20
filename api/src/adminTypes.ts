import type express from "express";
import type {Model} from "mongoose";

import type {PermissionMethod, RESTPermissions} from "./permissions";
import type {ScriptArgDef, ScriptRunner} from "./scriptRunner";

/** Server-side cap on bulk action id lists (v2 bulk-patch). */
export const MAX_BULK_PATCH_IDS = 1000;

export type AdminFilterKind = "boolean" | "choice" | "dateRange" | "ref" | "text";

export interface AdminFilterBoolean {
  field: string;
  kind: "boolean";
  label?: string;
}

export interface AdminFilterChoice {
  choices: {label: string; value: string}[];
  field: string;
  kind: "choice";
  label?: string;
}

export interface AdminFilterDateRange {
  field: string;
  kind: "dateRange";
  label?: string;
}

export interface AdminFilterRef {
  field: string;
  kind: "ref";
  label?: string;
  refModel?: string;
}

export interface AdminFilterText {
  field: string;
  kind: "text";
  label?: string;
}

export type AdminFilter =
  | AdminFilterBoolean
  | AdminFilterChoice
  | AdminFilterDateRange
  | AdminFilterRef
  | AdminFilterText;

export interface AdminFieldset {
  collapsed?: boolean;
  description?: string;
  fields: string[];
  title: string;
}

export interface AdminFieldOverride {
  helpText?: string;
  label?: string;
  widget?: string;
}

/** Declarative bulk action (v2 bulk-patch / background-tasks — no imperative run handler). */
export interface AdminAction {
  background?: boolean;
  confirm?: string;
  id: string;
  label: string;
  /** Keys allowed for synchronous bulk-patch actions */
  patchKeys?: string[];
}

export interface AdminModelPermissions {
  create?: boolean;
  delete?: boolean;
  update?: boolean;
}

export interface AdminConfig {
  displayName: string;
  group?: string;
  icon?: string;
  listFields: string[];
  listDisplay?: string[];
  listDisplayLinks?: string[];
  searchFields?: string[];
  sortableFields?: string[];
  defaultSort?: string | string[];
  pageSize?: number;
  filters?: AdminFilter[];
  fieldsets?: AdminFieldset[];
  fieldOrder?: string[];
  readonlyFields?: string[];
  excludeFields?: string[];
  hiddenFields?: string[];
  autocompleteFields?: string[];
  fieldOverrides?: Record<string, AdminFieldOverride>;
  adminPermissions?: Partial<{
    create: PermissionMethod<unknown>[];
    delete: PermissionMethod<unknown>[];
    list: PermissionMethod<unknown>[];
    read: PermissionMethod<unknown>[];
    update: PermissionMethod<unknown>[];
  }>;
  adminFilter?: (req: express.Request) => Record<string, unknown> | Promise<Record<string, unknown>>;
  actions?: AdminAction[];
  /** When true, scrubbed `admin:model.changed` events fire after mutations (no socket transport). */
  realtime?: boolean;
  /** Forward-compat placeholder — no behavior in v1. */
  includeDeleted?: boolean;
  bulkPatchAllowlist?: string[];
  recordTitleField?: string;
}

export interface AdminScriptContribution {
  args?: ScriptArgDef[];
  description: string;
  name: string;
  runner: ScriptRunner;
}

export interface AdminCustomScreen {
  displayName: string;
  group?: string;
  icon?: string;
  name: string;
}

export interface AdminHomeSlots {
  contentTop?: string[];
  main?: string[];
  navGlobal?: string[];
  sidebar?: string[];
}

export interface AdminHomeConfig {
  slots?: AdminHomeSlots;
  title?: string;
  /** Legacy widget ids; normalized to `slots.main` by admin-backend when slots omitted. */
  widgets?: string[];
}

export interface AdminHomeWidgetContribution {
  displayName: string;
  icon?: string;
  id: string;
  watches?: string[];
}

export interface AdminModelContribution<T = unknown> {
  admin: AdminConfig;
  model: Model<T>;
  permissions?: RESTPermissions<T>;
  routePath: string;
}

export interface AdminContribution {
  customScreens?: AdminCustomScreen[];
  homeWidgets?: AdminHomeWidgetContribution[];
  models?: AdminModelContribution[];
  scripts?: AdminScriptContribution[];
}

export type AdminChangeType = "create" | "delete" | "update";

export interface AdminChangeEvent {
  at: string;
  document?: unknown;
  documentId: string;
  modelName: string;
  routePath: string;
  type: AdminChangeType;
  user: {id: string};
}

export type AdminModelAdminMap = Record<string, AdminConfig>;

export type TerrenoAppAdminEvent = "admin:model.changed";
