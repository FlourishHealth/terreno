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

export interface VertexModelPickerOption {
  label: string;
  value: string;
}

/** How {@link VertexModelRegistryOptions.catalog} and {@link VertexModelRegistryOptions.additionalCatalog} combine. */
export type VertexModelCatalogMode = "extend" | "replace";

export interface VertexModelRegistryOptions {
  /**
   * When `replace`, `catalog` is the full allowlist (defaults omitted unless `includeDefaultCatalog` is true).
   * When `extend` (default), `catalog` merges on top of defaults / `additionalCatalog`.
   */
  catalogMode?: VertexModelCatalogMode;
  /** Base or replacement catalog entries (see `catalogMode`). */
  catalog?: VertexModelEntry[];
  /** Extra entries merged after the base catalog; later `id` wins. */
  additionalCatalog?: VertexModelEntry[];
  /** When `catalogMode` is `replace`, also merge {@link DEFAULT_VERTEX_MODEL_CATALOG} first. Default false. */
  includeDefaultCatalog?: boolean;
  defaultModelId?: string;
  titleModelId?: string;
  /** Allow gemini-shaped ids not in the catalog. Default true. */
  allowUnknownGeminiModels?: boolean;
  /** Allow claude-shaped ids not in the catalog when Anthropic is enabled. Default false. */
  allowUnknownAnthropicModels?: boolean;
  /** Allow MaaS-shaped ids not in the catalog when MaaS is enabled. Default false. */
  allowUnknownMaasModels?: boolean;
  isAnthropicEnabled?: () => boolean;
  isMaasEnabled?: () => boolean;
}

/**
 * Curated models for the example app via Gemini Enterprise Agent Platform (Vertex AI).
 * @see https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions
 */
export const DEFAULT_VERTEX_MODEL_CATALOG: VertexModelEntry[] = [
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

/** Default chat model (Gemini on Vertex Model Garden). */
export const DEFAULT_VERTEX_MODEL_ID = "gemini-3.5-flash";

/** Lightweight model for auto-generated conversation titles. */
export const TITLE_VERTEX_MODEL_ID = "gemini-3.1-flash-lite";

/** @deprecated Use {@link DEFAULT_VERTEX_MODEL_CATALOG}. Kept for backward compatibility. */
export const VERTEX_MODEL_CATALOG = DEFAULT_VERTEX_MODEL_CATALOG;

const defaultIsAnthropicFeatureEnabled = (): boolean =>
  process.env.GOOGLE_VERTEX_ENABLE_ANTHROPIC_MODELS === "true";

const defaultIsMaasFeatureEnabled = (): boolean =>
  process.env.GOOGLE_VERTEX_ENABLE_MAAS_MODELS === "true";

const mergeCatalogEntries = (...groups: VertexModelEntry[][]): VertexModelEntry[] => {
  const byId = new Map<string, VertexModelEntry>();
  for (const group of groups) {
    for (const entry of group) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
};

const resolveCatalog = (options: VertexModelRegistryOptions): VertexModelEntry[] => {
  const mode = options.catalogMode ?? "extend";
  const catalog = options.catalog ?? [];
  const additional = options.additionalCatalog ?? [];

  if (mode === "replace") {
    const base = options.includeDefaultCatalog ? DEFAULT_VERTEX_MODEL_CATALOG : [];
    return mergeCatalogEntries(base, catalog, additional);
  }

  return mergeCatalogEntries(DEFAULT_VERTEX_MODEL_CATALOG, catalog, additional);
};

/** Map catalog entries to UI picker options (enabled entries only). */
export const vertexCatalogToPickerOptions = (
  entries: VertexModelEntry[],
  isAnthropicEnabled: () => boolean = defaultIsAnthropicFeatureEnabled,
  isMaasEnabled: () => boolean = defaultIsMaasFeatureEnabled
): VertexModelPickerOption[] =>
  entries
    .filter((entry) => {
      if (entry.requiresFeatureFlag === "anthropic") {
        return isAnthropicEnabled();
      }
      if (entry.requiresFeatureFlag === "maas") {
        return isMaasEnabled();
      }
      return true;
    })
    .map((entry) => ({label: entry.label, value: entry.id}));

/**
 * Infer provider from a raw model id when not in the catalog (e.g. custom Vertex ids).
 * Gemini Enterprise Model Garden routes third-party models by id shape.
 */
export const inferVertexModelProvider = (
  modelId: string,
  catalogById?: Map<string, VertexModelEntry>
): VertexModelProviderKind => {
  const catalogEntry = catalogById?.get(modelId);
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

export class VertexModelRegistry {
  private readonly catalog: VertexModelEntry[];
  private readonly catalogById: Map<string, VertexModelEntry>;
  private readonly defaultModelId: string;
  private readonly titleModelId: string;
  private readonly allowUnknownGeminiModels: boolean;
  private readonly allowUnknownAnthropicModels: boolean;
  private readonly allowUnknownMaasModels: boolean;
  private readonly isAnthropicEnabled: () => boolean;
  private readonly isMaasEnabled: () => boolean;

  constructor(options: VertexModelRegistryOptions = {}) {
    this.catalog = resolveCatalog(options);
    this.catalogById = new Map(this.catalog.map((entry) => [entry.id, entry]));
    this.defaultModelId = options.defaultModelId ?? DEFAULT_VERTEX_MODEL_ID;
    this.titleModelId = options.titleModelId ?? TITLE_VERTEX_MODEL_ID;
    this.allowUnknownGeminiModels = options.allowUnknownGeminiModels ?? true;
    this.allowUnknownAnthropicModels = options.allowUnknownAnthropicModels ?? false;
    this.allowUnknownMaasModels = options.allowUnknownMaasModels ?? false;
    this.isAnthropicEnabled = options.isAnthropicEnabled ?? defaultIsAnthropicFeatureEnabled;
    this.isMaasEnabled = options.isMaasEnabled ?? defaultIsMaasFeatureEnabled;
  }

  getDefaultModelId = (): string => this.defaultModelId;

  getTitleModelId = (): string => this.titleModelId;

  getCatalog = (): VertexModelEntry[] => [...this.catalog];

  /** Models exposed in API/UI given current env flags. */
  getEnabledCatalog = (): VertexModelEntry[] =>
    this.catalog.filter((entry) => {
      if (entry.requiresFeatureFlag === "anthropic") {
        return this.isAnthropicEnabled();
      }
      if (entry.requiresFeatureFlag === "maas") {
        return this.isMaasEnabled();
      }
      return true;
    });

  getPickerOptions = (): VertexModelPickerOption[] =>
    vertexCatalogToPickerOptions(this.getEnabledCatalog(), this.isAnthropicEnabled, this.isMaasEnabled);

  inferProvider = (modelId: string): VertexModelProviderKind =>
    inferVertexModelProvider(modelId, this.catalogById);

  /** Whether this model id is allowed for server-side Vertex routing. */
  isModelAllowed = (modelId: string): boolean => {
    const entry = this.catalogById.get(modelId);
    if (entry) {
      if (entry.requiresFeatureFlag === "anthropic") {
        return this.isAnthropicEnabled();
      }
      if (entry.requiresFeatureFlag === "maas") {
        return this.isMaasEnabled();
      }
      return true;
    }

    const providerKind = this.inferProvider(modelId);
    if (providerKind === "gemini") {
      return this.allowUnknownGeminiModels;
    }
    if (providerKind === "anthropic") {
      return this.allowUnknownAnthropicModels && this.isAnthropicEnabled();
    }
    return this.allowUnknownMaasModels && this.isMaasEnabled();
  };
}

/** Create an isolated registry (does not affect the process-wide default). */
export const createVertexModelRegistry = (options?: VertexModelRegistryOptions): VertexModelRegistry =>
  new VertexModelRegistry(options);

let activeRegistry: VertexModelRegistry = createVertexModelRegistry();

/** Process-wide Vertex model registry used by {@link resolveVertexLanguageModel} and helpers. */
export const getVertexModelRegistry = (): VertexModelRegistry => activeRegistry;

/**
 * Replace the process-wide registry (e.g. at app startup).
 * Resets cached Vertex SDK providers so new feature-flag handlers apply.
 */
export const configureVertexModels = (options: VertexModelRegistryOptions): VertexModelRegistry => {
  activeRegistry = createVertexModelRegistry(options);
  vertexProviderBundle = undefined;
  return activeRegistry;
};

/** Reset to built-in defaults (mostly for tests). */
export const resetVertexModels = (): VertexModelRegistry => configureVertexModels({});

// --- Module-level helpers delegating to active registry ---

export const getEnabledVertexModelCatalog = (): VertexModelEntry[] =>
  getVertexModelRegistry().getEnabledCatalog();

export const getVertexModelPickerOptions = (): VertexModelPickerOption[] =>
  getVertexModelRegistry().getPickerOptions();

export const isVertexModelAllowed = (modelId: string): boolean =>
  getVertexModelRegistry().isModelAllowed(modelId);

export const inferVertexModelProviderFromRegistry = (modelId: string): VertexModelProviderKind =>
  getVertexModelRegistry().inferProvider(modelId);

// Re-export with legacy name used by tests
export {inferVertexModelProviderFromRegistry as inferVertexModelProviderForActiveRegistry};

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

  const registry = getVertexModelRegistry();

  const bundle: VertexProviderBundle = {
    gemini: geminiModule.createVertex({
      location: getGeminiLocation(),
      project,
    }),
  };

  const anthropicModule = getVertexAnthropicModule();
  if (anthropicModule && registry.isModelAllowed("claude-sonnet-4-6")) {
    bundle.anthropic = anthropicModule.createVertexAnthropic({
      location: getAnthropicLocation(),
      project,
    });
  }

  const maasModule = getVertexMaasModule();
  if (maasModule && registry.isModelAllowed("openai/gpt-oss-20b-maas")) {
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

  const registry = getVertexModelRegistry();
  if (!registry.isModelAllowed(modelId)) {
    return undefined;
  }

  const providerKind = registry.inferProvider(modelId);

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
