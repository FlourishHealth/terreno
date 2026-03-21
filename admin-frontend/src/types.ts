import type {Api} from "@reduxjs/toolkit/query/react";

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
  fieldOrder?: string[];
}

export interface AdminScriptConfig {
  name: string;
  description: string;
}

export interface AdminConfigResponse {
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
