import {resetAiServiceCache} from "./api/ai";
import type {VertexModelEntry, VertexModelRegistryOptions} from "./api/vertexModels";
import {configureVertexModels} from "./api/vertexModels";
import {AppConfiguration} from "./models/appConfiguration";
import {
  resetVertexAdminSettings,
  setVertexAdminSettings,
  type VertexAdminSettings,
} from "./vertexAdminSettings";

const isVertexProviderKind = (value: unknown): value is VertexModelEntry["provider"] =>
  value === "gemini" || value === "anthropic" || value === "maas";

const normalizeCatalogEntries = (value: unknown): VertexModelEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: VertexModelEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.label !== "string") {
      continue;
    }
    if (!isVertexProviderKind(record.provider)) {
      continue;
    }
    entries.push({
      id: record.id,
      label: record.label,
      provider: record.provider,
    });
  }
  return entries;
};

export const buildVertexAdminSettingsFromAppConfig = (vertexAi: unknown): VertexAdminSettings => {
  const config = (vertexAi ?? {}) as Record<string, unknown>;

  return {
    additionalCatalog: normalizeCatalogEntries(config.additionalCatalog),
    allowUnknownAnthropicModels: config.allowUnknownAnthropicModels === true,
    allowUnknownGeminiModels: config.allowUnknownGeminiModels !== false,
    allowUnknownMaasModels: config.allowUnknownMaasModels === true,
    anthropicLocation:
      typeof config.anthropicLocation === "string" && config.anthropicLocation.length > 0
        ? config.anthropicLocation
        : "us-east5",
    catalogMode: config.catalogMode === "replace" ? "replace" : "extend",
    defaultModelId:
      typeof config.defaultModelId === "string" && config.defaultModelId.length > 0
        ? config.defaultModelId
        : "gemini-3.5-flash",
    enableAnthropicModels: config.enableAnthropicModels === true,
    enabled: config.enabled === true,
    enableMaasModels: config.enableMaasModels === true,
    geminiApiKey: typeof config.geminiApiKey === "string" ? config.geminiApiKey : "",
    includeDefaultCatalog: config.includeDefaultCatalog !== false,
    location:
      typeof config.location === "string" && config.location.length > 0
        ? config.location
        : "us-central1",
    projectId: typeof config.projectId === "string" ? config.projectId : "",
    titleModelId:
      typeof config.titleModelId === "string" && config.titleModelId.length > 0
        ? config.titleModelId
        : "gemini-3.1-flash-lite",
  };
};

export const buildExampleVertexModelRegistryOptions = (
  admin: VertexAdminSettings
): VertexModelRegistryOptions => ({
  additionalCatalog: admin.additionalCatalog,
  allowUnknownAnthropicModels: admin.allowUnknownAnthropicModels,
  allowUnknownGeminiModels: admin.allowUnknownGeminiModels,
  allowUnknownMaasModels: admin.allowUnknownMaasModels,
  catalogMode: admin.catalogMode,
  defaultModelId: admin.defaultModelId,
  includeDefaultCatalog: admin.includeDefaultCatalog,
  isAnthropicEnabled: () => admin.enableAnthropicModels,
  isMaasEnabled: () => admin.enableMaasModels,
  titleModelId: admin.titleModelId,
});

export const loadVertexAdminSettingsFromAppConfiguration =
  async (): Promise<VertexAdminSettings> => {
    const vertexAi = await AppConfiguration.getConfig("vertexAi");
    return buildVertexAdminSettingsFromAppConfig(vertexAi);
  };

/** Configure process-wide Vertex models from admin AppConfiguration (call after MongoDB connect). */
export const configureExampleVertexModelsFromAdmin = async (): Promise<void> => {
  const admin = await loadVertexAdminSettingsFromAppConfiguration();
  setVertexAdminSettings(admin);
  configureVertexModels(buildExampleVertexModelRegistryOptions(admin));
  resetAiServiceCache();
};

/** Reset admin-driven Vertex configuration (mostly for tests). */
export const resetExampleVertexModelsFromAdmin = (): void => {
  resetVertexAdminSettings();
  configureVertexModels({});
  resetAiServiceCache();
};
