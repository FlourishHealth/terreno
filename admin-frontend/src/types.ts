import type {Api} from "@reduxjs/toolkit/query/react";

// ─── Chart types (mirrored from @terreno/admin-backend for frontend use) ─────

export type ChartType =
  | "bar"
  | "bar-horizontal"
  | "bar-stacked"
  | "bar-grouped"
  | "line"
  | "line-multi"
  | "area"
  | "area-stacked"
  | "pie"
  | "donut"
  | "scatter"
  | "bubble"
  | "heatmap"
  | "combo";

export type Aggregation =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "countDistinct"
  | "runningTotal"
  | "rank";

export type DateTrunc = "year" | "quarter" | "month" | "week" | "day" | "hour";

export interface AxisConfig {
  field: string;
  label?: string;
  aggregation?: Aggregation;
  dateTrunc?: DateTrunc;
}

export type FilterConfig =
  | {
      type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
      field: string;
      value: string | number | boolean | null;
    }
  | {type: "in" | "nin"; field: string; values: (string | number | boolean | null)[]}
  | {type: "dateRange"; field: string; from?: string; to?: string}
  | {type: "relative"; field: string; unit: DateTrunc; amount: number};

export interface ChartConfig {
  type: ChartType;
  title: string;
  dataSource: string;
  x: AxisConfig;
  y: AxisConfig | AxisConfig[];
  color?: {field: string; label?: string};
  size?: AxisConfig;
  filters?: FilterConfig[];
  sort?: {field: string; direction: "asc" | "desc"};
  limit?: number;
}

export interface AdminFieldConfig {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  ref?: string;
  widget?: string;
}

export interface AdminModelConfig {
  name: string;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort: string;
  fields: Record<string, AdminFieldConfig>;
}

export interface AdminCustomScreen {
  displayName: string;
  name: string;
}

export interface AdminScriptConfig {
  name: string;
  description: string;
}

export interface DataSourceFieldMeta {
  type: "string" | "number" | "date" | "boolean";
  description: string;
  role: "dimension" | "measure";
}

export interface DataSourceMeta {
  name: string;
  displayName: string;
  fields: Record<string, DataSourceFieldMeta>;
}

export interface AdminConfigResponse {
  customScreens?: AdminCustomScreen[];
  models: AdminModelConfig[];
  scripts: AdminScriptConfig[];
  dataSources?: DataSourceMeta[];
  supportsWindowFields?: boolean;
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
  api: Api<any, any, any, any>;
}

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
  api: Api<any, any, any, any>;
  basePath: string;
  title?: string;
  allowDelete?: boolean;
  allowUpload?: boolean;
  onFileSelect?: (file: DocumentFile) => void;
  onSettingsPress?: () => void;
}
