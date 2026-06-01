import type {VertexModelEntry} from "./api/vertexModels";

export interface VertexAdminSettings {
  additionalCatalog: VertexModelEntry[];
  allowUnknownAnthropicModels: boolean;
  allowUnknownGeminiModels: boolean;
  allowUnknownMaasModels: boolean;
  anthropicLocation: string;
  catalogMode: "extend" | "replace";
  defaultModelId: string;
  enableAnthropicModels: boolean;
  enableMaasModels: boolean;
  enabled: boolean;
  geminiApiKey: string;
  includeDefaultCatalog: boolean;
  location: string;
  projectId: string;
  titleModelId: string;
}

export const DEFAULT_VERTEX_ADMIN_SETTINGS: VertexAdminSettings = {
  additionalCatalog: [],
  allowUnknownAnthropicModels: false,
  allowUnknownGeminiModels: true,
  allowUnknownMaasModels: false,
  anthropicLocation: "us-east5",
  catalogMode: "extend",
  defaultModelId: "gemini-3.5-flash",
  enableAnthropicModels: false,
  enabled: false,
  enableMaasModels: false,
  geminiApiKey: "",
  includeDefaultCatalog: true,
  location: "us-central1",
  projectId: "",
  titleModelId: "gemini-3.1-flash-lite",
};

let activeVertexAdminSettings: VertexAdminSettings = {...DEFAULT_VERTEX_ADMIN_SETTINGS};

export const getVertexAdminSettings = (): VertexAdminSettings => activeVertexAdminSettings;

export const setVertexAdminSettings = (settings: VertexAdminSettings): void => {
  activeVertexAdminSettings = settings;
};

export const resetVertexAdminSettings = (): void => {
  activeVertexAdminSettings = {...DEFAULT_VERTEX_ADMIN_SETTINGS};
};

export const isVertexAiEnabled = (): boolean =>
  activeVertexAdminSettings.enabled && activeVertexAdminSettings.projectId.length > 0;
