import {resetAiServiceCache} from "./api/ai";
import type {VertexModelEntry, VertexModelRegistryOptions} from "./api/vertexModels";
import {configureVertexModels} from "./api/vertexModels";

const parseBooleanEnv = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) {
    return defaultValue;
  }
  return value === "true" || value === "1";
};

const parseExtraCatalogFromEnv = (): VertexModelEntry[] | undefined => {
  const raw = process.env.VERTEX_EXTRA_MODEL_CATALOG_JSON;
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as VertexModelEntry[];
  } catch {
    return undefined;
  }
};

/**
 * Example-app Vertex model registry setup.
 * Downstream apps call {@link configureVertexModels} at startup with their own catalog/options.
 */
export const buildExampleVertexModelRegistryOptions = (): VertexModelRegistryOptions => {
  const additionalCatalog = parseExtraCatalogFromEnv();

  return {
    additionalCatalog,
    allowUnknownAnthropicModels: parseBooleanEnv(
      process.env.GOOGLE_VERTEX_ALLOW_UNKNOWN_ANTHROPIC_MODELS,
      false
    ),
    allowUnknownGeminiModels: parseBooleanEnv(
      process.env.GOOGLE_VERTEX_ALLOW_UNKNOWN_GEMINI_MODELS,
      true
    ),
    allowUnknownMaasModels: parseBooleanEnv(
      process.env.GOOGLE_VERTEX_ALLOW_UNKNOWN_MAAS_MODELS,
      false
    ),
    catalogMode: process.env.VERTEX_MODEL_CATALOG_MODE === "replace" ? "replace" : "extend",
    defaultModelId: process.env.GOOGLE_VERTEX_DEFAULT_MODEL,
    includeDefaultCatalog: process.env.VERTEX_INCLUDE_DEFAULT_CATALOG !== "false",
    titleModelId: process.env.GOOGLE_VERTEX_TITLE_MODEL,
  };
};

/** Configure process-wide Vertex models for the example backend (call before route registration). */
export const configureExampleVertexModels = (): void => {
  configureVertexModels(buildExampleVertexModelRegistryOptions());
  resetAiServiceCache();
};
