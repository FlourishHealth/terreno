import type {Api} from "@reduxjs/toolkit/query/react";

export interface AdminFieldConfig {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  ref?: string;
}

export interface AdminModelConfig {
  name: string;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort: string;
  fields: Record<string, AdminFieldConfig>;
}

export interface AdminConfigResponse {
  models: AdminModelConfig[];
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
}
