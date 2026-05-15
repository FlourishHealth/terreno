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
// biome-ignore lint/suspicious/noExplicitAny: RTK Query's Api generics are erased at the dynamic endpoint injection boundary
export type AdminApi = Api<any, any, any, any>;

/**
 * Generic field/document value used throughout the admin panel.
 *
 * Admin screens operate over arbitrary Mongoose documents whose field types are not
 * known statically — they are discovered at runtime via the `/admin/config` endpoint.
 */
// biome-ignore lint/suspicious/noExplicitAny: Mongoose document field types are heterogeneous and discovered dynamically
export type AdminFieldValue = any;

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

export interface AdminConfigResponse {
  customScreens?: AdminCustomScreen[];
  models: AdminModelConfig[];
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

export interface AdminScreenProps {
  baseUrl: string;
  api: AdminApi;
}

/**
 * Props passed to a custom ref-field renderer. Matches AdminRefField's interface so a
 * custom renderer is a drop-in replacement.
 */
export interface RefFieldRendererProps {
  api: AdminApi;
  baseUrl: string;
  routePath: string;
  refModelName: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  errorText?: string;
  helperText?: string;
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
