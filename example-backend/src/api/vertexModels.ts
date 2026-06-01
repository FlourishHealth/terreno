import type {ImageModel, LanguageModel} from "ai";

/** Vertex / Gemini Enterprise Agent Platform model provider kind. */
export type VertexModelProviderKind = "gemini" | "anthropic" | "maas";

export interface VertexModelEntry {
  id: string;
  label: string;
  provider: VertexModelProviderKind;
  /** When true, only listed when the matching GOOGLE_VERTEX_ENABLE_* env is set. */
  requiresFeatureFlag?: "anthropic" | "maas";
}

/** Default chat model (Gemini on Vertex Model Garden). */
export const DEFAULT_VERTEX_MODEL_ID = "gemini-3.5-flash";

/** Lightweight model for auto-generated conversation titles. */
export const TITLE_VERTEX_MODEL_ID = "gemini-3.1-flash-lite";

/**
 * Curated models for the example app via Gemini Enterprise Agent Platform (Vertex AI).
 * @see https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions
 */
export const VERTEX_MODEL_CATALOG: VertexModelEntry[] = [
  {id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "gemini"},
  {id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", provider: "gemini"},
  {id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", provider: "gemini"},
  {id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini"},
  {id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini"},
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6 (Vertex)",
    provider: "anthropic",
    requiresFeatureFlag: "anthropic",
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6 (Vertex)",
    provider: "anthropic",
    requiresFeatureFlag: "anthropic",
  },
  {
    id: "openai/gpt-oss-20b-maas",
    label: "GPT-OSS 20B (Vertex MaaS)",
    provider: "maas",
    requiresFeatureFlag: "maas",
  },
];

const isAnthropicFeatureEnabled = (): boolean =>
  process.env.GOOGLE_VERTEX_ENABLE_ANTHROPIC_MODELS === "true";

const isMaasFeatureEnabled = (): boolean => process.env.GOOGLE_VERTEX_ENABLE_MAAS_MODELS === "true";

/** Models exposed in API/UI given current env flags. */
export const getEnabledVertexModelCatalog = (): VertexModelEntry[] =>
  VERTEX_MODEL_CATALOG.filter((entry) => {
    if (entry.requiresFeatureFlag === "anthropic") {
      return isAnthropicFeatureEnabled();
    }
    if (entry.requiresFeatureFlag === "maas") {
      return isMaasFeatureEnabled();
    }
    return true;
  });

const catalogById = (): Map<string, VertexModelEntry> =>
  new Map(VERTEX_MODEL_CATALOG.map((entry) => [entry.id, entry]));

/**
 * Infer provider from a raw model id when not in the catalog (e.g. custom Vertex ids).
 * Gemini Enterprise Model Garden routes third-party models by id shape.
 */
export const inferVertexModelProvider = (modelId: string): VertexModelProviderKind => {
  const catalogEntry = catalogById().get(modelId);
  if (catalogEntry) {
    return catalogEntry.provider;
  }

  const normalized = modelId.toLowerCase();
  if (normalized.startsWith("claude-")) {
    return "anthropic";
  }
  if (
    normalized.includes("-maas") ||
    normalized.startsWith("openai/") ||
    normalized.startsWith("deepseek-ai/") ||
    normalized.startsWith("meta/") ||
    normalized.startsWith("qwen/")
  ) {
    return "maas";
  }
  return "gemini";
};

/** Whether this model id is allowed for server-side Vertex routing. */
export const isVertexModelAllowed = (modelId: string): boolean => {
  const entry = catalogById().get(modelId);
  if (!entry) {
    return inferVertexModelProvider(modelId) === "gemini";
  }
  if (entry.requiresFeatureFlag === "anthropic") {
    return isAnthropicFeatureEnabled();
  }
  if (entry.requiresFeatureFlag === "maas") {
    return isMaasFeatureEnabled();
  }
  return true;
};

type LanguageModelFactory = (modelId: string) => LanguageModel;

interface VertexGeminiProvider {
  (modelId: string): LanguageModel;
  image: (modelId: string) => ImageModel;
}

interface VertexGeminiModule {
  createVertex: (opts: {location: string; project: string}) => VertexGeminiProvider;
}

interface VertexAnthropicModule {
  createVertexAnthropic: (opts: {location: string; project: string}) => LanguageModelFactory;
}

interface VertexMaasModule {
  createVertexMaas: (opts: {location: string; project: string}) => LanguageModelFactory;
}

const getVertexGeminiModule = (): VertexGeminiModule | undefined => {
  try {
    return require("@ai-sdk/google-vertex") as VertexGeminiModule;
  } catch {
    return undefined;
  }
};

const getVertexAnthropicModule = (): VertexAnthropicModule | undefined => {
  try {
    return require("@ai-sdk/google-vertex/anthropic") as VertexAnthropicModule;
  } catch {
    return undefined;
  }
};

const getVertexMaasModule = (): VertexMaasModule | undefined => {
  try {
    return require("@ai-sdk/google-vertex/maas") as VertexMaasModule;
  } catch {
    return undefined;
  }
};

interface VertexProviderBundle {
  gemini: VertexGeminiProvider;
  anthropic?: LanguageModelFactory;
  maas?: LanguageModelFactory;
}

let vertexProviderBundle: VertexProviderBundle | undefined;

const getVertexProject = (): string | undefined => process.env.GOOGLE_VERTEX_PROJECT;

const getGeminiLocation = (): string => process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";

const getAnthropicLocation = (): string =>
  process.env.GOOGLE_VERTEX_ANTHROPIC_LOCATION ?? "us-east5";

/** Lazy-init Vertex providers (Gemini, Anthropic, MaaS) for Gemini Enterprise. */
export const getVertexProviderBundle = (): VertexProviderBundle | undefined => {
  if (vertexProviderBundle) {
    return vertexProviderBundle;
  }

  const project = getVertexProject();
  if (!project) {
    return undefined;
  }

  const geminiModule = getVertexGeminiModule();
  if (!geminiModule) {
    return undefined;
  }

  const bundle: VertexProviderBundle = {
    gemini: geminiModule.createVertex({
      location: getGeminiLocation(),
      project,
    }),
  };

  const anthropicModule = getVertexAnthropicModule();
  if (anthropicModule && isAnthropicFeatureEnabled()) {
    bundle.anthropic = anthropicModule.createVertexAnthropic({
      location: getAnthropicLocation(),
      project,
    });
  }

  const maasModule = getVertexMaasModule();
  if (maasModule && isMaasFeatureEnabled()) {
    bundle.maas = maasModule.createVertexMaas({
      location: getGeminiLocation(),
      project,
    });
  }

  vertexProviderBundle = bundle;
  return vertexProviderBundle;
};

/** Resolve a model id to a Vertex LanguageModel, or undefined if Vertex/disabled. */
export const resolveVertexLanguageModel = (modelId: string): LanguageModel | undefined => {
  const bundle = getVertexProviderBundle();
  if (!bundle) {
    return undefined;
  }

  if (!isVertexModelAllowed(modelId)) {
    return undefined;
  }

  const providerKind = inferVertexModelProvider(modelId);

  if (providerKind === "anthropic") {
    if (!bundle.anthropic) {
      return undefined;
    }
    return bundle.anthropic(modelId);
  }

  if (providerKind === "maas") {
    if (!bundle.maas) {
      return undefined;
    }
    return bundle.maas(modelId);
  }

  return bundle.gemini(modelId);
};

/** Gemini Vertex provider (language + Imagen image models). */
export const getVertexGeminiProvider = (): VertexGeminiProvider | undefined => {
  const bundle = getVertexProviderBundle();
  return bundle?.gemini;
};
