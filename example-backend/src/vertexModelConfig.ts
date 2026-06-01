import {resetAiServiceCache} from "./api/ai";
import type {
  VertexModelEntry,
  VertexModelProviderKind,
  VertexModelRegistryOptions,
} from "./api/vertexModels";
import {configureVertexModels} from "./api/vertexModels";

const isVertexProviderKind = (value: unknown): value is VertexModelProviderKind =>
  value === "gemini" || value === "anthropic" || value === "maas";

const isVertexModelEntry = (value: unknown): value is VertexModelEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || typeof entry.label !== "string") {
    return false;
  }
  if (!isVertexProviderKind(entry.provider)) {
    return false;
  }
  if (
    entry.requiresFeatureFlag !== undefined &&
    entry.requiresFeatureFlag !== "anthropic" &&
    entry.requiresFeatureFlag !== "maas"
  ) {
    return false;
  }
  return true;
};

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
    const entries = parsed.filter(isVertexModelEntry);
    if (entries.length === 0) {
      return undefined;
    }
    return entries;
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
