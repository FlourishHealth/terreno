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
