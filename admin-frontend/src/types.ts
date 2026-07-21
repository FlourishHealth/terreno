import type {Api} from "@reduxjs/toolkit/query/react";
import type React from "react";

/**
 * Type alias for an RTK Query API instance with type-erased generic parameters.
 *
 * The admin panel dynamically injects endpoints into the consumer's RTK Query API at
 * runtime via `api.injectEndpoints()`. The consumer's API is built from a generated
 * OpenAPI SDK with thousands of distinct endpoint types — there is no shared base
 * type we can constrain to, so the generic parameters are erased.
 */
// noExplicitAny: RTK Query's Api generics are erased at the dynamic endpoint injection boundary
// biome-ignore lint/suspicious/noExplicitAny: RTK Query's Api generics are erased at the dynamic endpoint injection boundary
export type AdminApi = Api<any, any, any, any>;

/**
 * Generic field/document value used throughout the admin panel.
 *
 * Admin screens operate over arbitrary Mongoose documents whose field types are not
 * known statically — they are discovered at runtime via the `/admin/config` endpoint.
 * Read sites must narrow with `typeof` checks before passing to typed UI components.
 */
export type AdminFieldValue = unknown;

/**
 * RTK Query's `build` argument from `api.injectEndpoints({ endpoints: (build) => ... })`.
 *
 * The build helper is generic over the full endpoint set; since the admin panel injects
 * endpoints dynamically into a consumer-supplied API, the endpoint shapes are not
 * statically expressible here.
 */
// noExplicitAny: build helper from RTK Query's dynamic injectEndpoints API
// biome-ignore lint/suspicious/noExplicitAny: build helper from RTK Query's dynamic injectEndpoints API
export type EndpointBuilder = any;

export interface AdminFieldConfig {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: AdminFieldValue;
  ref?: string;
  searchable?: boolean;
  widget?: string;
  /** For array fields of sub-documents: metadata about each item's sub-fields */
  items?: Record<string, AdminFieldConfig>;
  /** For array fields of primitives: the item type (string/number/boolean/objectid) */
  itemType?: string;
  /** For array fields of primitives: enum values for each item */
  itemEnum?: string[];
  /** For array fields of ObjectId refs: the referenced model name */
  itemRef?: string;
}

export interface AdminModelPermissions {
  create?: boolean;
  delete?: boolean;
  update?: boolean;
}

export interface AdminModelConfig {
  name: string;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort: string;
  fields: Record<string, AdminFieldConfig>;
  fieldOrder?: string[];
  /** Optional per-column pixel widths used by AdminModelTable when rendering listFields. */
  listColumnWidths?: Record<string, number>;
  /**
   * Field key used for the edit screen title (stack / document title). When unset, the form
   * picks a scalar label from common keys (`name`, `title`, …) then the first list column.
   */
  recordTitleField?: string;
  /** Admin UI v2 — declarative bulk actions */
  actions?: {
    background?: boolean;
    confirm?: string;
    id: string;
    label: string;
    patchKeys?: string[];
  }[];
  bulkPatchAllowlist?: string[];
  fieldsets?: {fields: string[]; title: string}[];
  filters?: {
    choices?: {label: string; value: string}[];
    field: string;
    kind: string;
    label?: string;
  }[];
  group?: string;
  hiddenFields?: string[];
  listDisplay?: string[];
  listDisplayLinks?: string[];
  pageSize?: number;
  permissions?: AdminModelPermissions;
  readonlyFields?: string[];
  realtime?: boolean;
  searchFields?: string[];
  sortableFields?: string[];
}

export interface AdminCustomScreen {
  description?: string;
  displayName: string;
  name: string;
}

export interface AdminScriptConfig {
  name: string;
  description: string;
}

/** Admin UI v2 home layout slots (Django template-block analogue). */
export interface AdminHomeSlots {
  contentTop?: string[];
  main?: string[];
  navGlobal?: string[];
  sidebar?: string[];
}

export interface AdminHome {
  slots: AdminHomeSlots;
  title: string;
}

export interface AdminConfigResponse {
  customScreens?: AdminCustomScreen[];
  home?: AdminHome;
  models: AdminModelConfig[];
  schemaVersion?: number;
  scripts: AdminScriptConfig[];
}

export interface BackgroundTaskProgress {
  percentage: number;
  stage?: string;
  message?: string;
}

export interface BackgroundTaskLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface BackgroundTask {
  _id: string;
  taskType: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress?: BackgroundTaskProgress;
  isDryRun: boolean;
  result?: string[];
  error?: string;
  logs: BackgroundTaskLog[];
  startedAt?: string;
  completedAt?: string;
  created: string;
  updated: string;
}

/** A single past script run, as returned by `GET {apiBase}/scripts/runs`. */
export interface ScriptRun extends BackgroundTask {
  /** Display name (or email) of the admin who triggered the run, when available. */
  createdByName?: string;
}

/** Paginated response from the script run-history endpoint. */
export interface ScriptRunListResponse {
  data: ScriptRun[];
  limit: number;
  more: boolean;
  page: number;
  total: number;
}

/**
 * Common props for admin screens.
 *
 * The admin panel separates two distinct concepts:
 * - `apiBase`: the base path where JSON/API requests are sent (e.g. "/admin").
 * - `routeBase`: the base path used for in-app navigation (e.g. "/admin" when mounted
 *   inside an app, or "" for a standalone admin SPA whose navigation stays at its root).
 *
 * `baseUrl` is a backward-compatible alias: when only `baseUrl` is provided it is used
 * for BOTH the API base and the route base, preserving the original behavior. When
 * `apiBase`/`routeBase` are provided they take precedence over `baseUrl`. Use
 * {@link resolveAdminBases} to resolve the effective bases.
 */
export interface AdminScreenProps {
  /** @deprecated Use `apiBase` and `routeBase`. Kept as a backward-compatible alias. */
  baseUrl?: string;
  /** Base path where JSON/API requests are sent. Falls back to `baseUrl`. */
  apiBase?: string;
  /** Base path used for in-app navigation. Falls back to `baseUrl`. */
  routeBase?: string;
  api: AdminApi;
}

/**
 * Resolves the effective API and route bases from the (optional) `baseUrl`, `apiBase`,
 * and `routeBase` props. When only `baseUrl` is provided, both resolved bases equal it,
 * preserving the original single-prop behavior.
 */
export const resolveAdminBases = ({
  baseUrl,
  apiBase,
  routeBase,
}: {
  baseUrl?: string;
  apiBase?: string;
  routeBase?: string;
}): {apiBase: string; routeBase: string} => {
  return {
    apiBase: apiBase ?? baseUrl ?? "",
    routeBase: routeBase ?? baseUrl ?? "",
  };
};

/**
 * Props passed to a custom ref-field renderer. Matches AdminRefField's interface so a
 * custom renderer is a drop-in replacement.
 *
 * `routePath` is the API path used to fetch reference options (e.g. "/admin/users").
 * `routeBase` is the base path for in-app navigation to the referenced item.
 */
export interface RefFieldRendererProps {
  api: AdminApi;
  /** @deprecated Use `apiBase`/`routeBase`. Kept as a backward-compatible alias. */
  baseUrl?: string;
  /** Base path where JSON/API requests are sent. Falls back to `baseUrl`. */
  apiBase?: string;
  /** Base path used for in-app navigation. Falls back to `baseUrl`. */
  routeBase?: string;
  routePath: string;
  refModelName: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  errorText?: string;
  helperText?: string;
  /** When true, the picker is display-only and does not submit changes. */
  readOnly?: boolean;
}

/**
 * Map from referenced model name (e.g. "User") to a custom component used to render
 * fields that reference that model. When a key matches `fieldConfig.ref` (single ref)
 * or `fieldConfig.itemRef` (primitive array of refs), the custom component renders in
 * place of the built-in {@link AdminRefField}. Falls back to AdminRefField when no
 * key matches.
 */
export type RefRendererMap = Record<string, React.ComponentType<RefFieldRendererProps>>;

// System fields that should be skipped in forms
export const SYSTEM_FIELDS = new Set(["_id", "id", "__v", "created", "updated", "deleted"]);

export interface DocumentFile {
  name: string;
  fullPath: string;
  size: number;
  contentType: string | undefined;
  updated: string;
  isFolder: boolean;
}

export interface DocumentListResponse {
  files: DocumentFile[];
  folders: string[];
  prefix: string;
}

export interface DocumentStorageBrowserProps {
  api: AdminApi;
  basePath: string;
  title?: string;
  allowDelete?: boolean;
  allowUpload?: boolean;
  onFileSelect?: (file: DocumentFile) => void;
  onSettingsPress?: () => void;
}
