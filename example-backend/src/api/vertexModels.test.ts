import {afterEach, describe, expect, it} from "bun:test";
import {
  buildGptModelsResponseData,
  configureVertexModels,
  createVertexModelRegistry,
  DEFAULT_VERTEX_MODEL_ID,
  getEnabledVertexModelCatalog,
  getVertexModelPickerOptions,
  getVertexModelRegistry,
  inferVertexModelProvider,
  isVertexModelAllowed,
  resetVertexModels,
  TITLE_VERTEX_MODEL_ID,
} from "./vertexModels";

describe("vertexModels", () => {
  afterEach(() => {
    resetVertexModels();
  });

  it("uses expected default and title model ids", () => {
    expect(DEFAULT_VERTEX_MODEL_ID).toBe("gemini-3.5-flash");
    expect(TITLE_VERTEX_MODEL_ID).toBe("gemini-3.1-flash-lite");
  });

  it("infers provider kind from model id shape", () => {
    expect(inferVertexModelProvider("gemini-3.5-flash")).toBe("gemini");
    expect(inferVertexModelProvider("claude-sonnet-4-6")).toBe("anthropic");
    expect(inferVertexModelProvider("openai/gpt-oss-20b-maas")).toBe("maas");
    expect(inferVertexModelProvider("deepseek-ai/deepseek-v3.2-maas")).toBe("maas");
  });

  it("excludes anthropic and maas catalog entries unless provider toggles are on", () => {
    configureVertexModels({
      isAnthropicEnabled: () => false,
      isMaasEnabled: () => false,
    });

    const ids = getEnabledVertexModelCatalog().map((entry) => entry.id);
    expect(ids).toContain("gemini-3.5-flash");
    expect(ids).not.toContain("claude-sonnet-4-6");
    expect(ids).not.toContain("openai/gpt-oss-20b-maas");
  });

  it("includes optional models when provider toggles are enabled", () => {
    configureVertexModels({
      isAnthropicEnabled: () => true,
      isMaasEnabled: () => true,
    });

    const ids = getEnabledVertexModelCatalog().map((entry) => entry.id);
    expect(ids).toContain("claude-sonnet-4-6");
    expect(ids).toContain("openai/gpt-oss-20b-maas");
  });

  it("blocks catalog anthropic models when anthropic toggle is off", () => {
    configureVertexModels({
      isAnthropicEnabled: () => false,
      isMaasEnabled: () => false,
    });
    expect(isVertexModelAllowed("claude-sonnet-4-6")).toBe(false);
    expect(isVertexModelAllowed("gemini-3.1-pro-preview")).toBe(true);
  });

  it("allows unknown gemini-shaped ids for forward compatibility", () => {
    configureVertexModels({
      allowUnknownGeminiModels: true,
      isAnthropicEnabled: () => false,
      isMaasEnabled: () => false,
    });
    expect(isVertexModelAllowed("gemini-9-experimental")).toBe(true);
    expect(isVertexModelAllowed("claude-custom@20260101")).toBe(false);
  });

  it("configureVertexModels replaces defaults and catalog in replace mode", () => {
    configureVertexModels({
      allowUnknownGeminiModels: false,
      catalog: [{id: "custom-gemini", label: "Custom Gemini", provider: "gemini"}],
      catalogMode: "replace",
      defaultModelId: "custom-gemini",
      isAnthropicEnabled: () => false,
      isMaasEnabled: () => false,
      titleModelId: "custom-gemini",
    });

    const registry = getVertexModelRegistry();
    expect(registry.getDefaultModelId()).toBe("custom-gemini");
    expect(registry.getTitleModelId()).toBe("custom-gemini");
    expect(getVertexModelPickerOptions()).toEqual([
      {label: "Custom Gemini", value: "custom-gemini"},
    ]);
    expect(isVertexModelAllowed("gemini-3.5-flash")).toBe(false);
    expect(isVertexModelAllowed("custom-gemini")).toBe(true);
  });

  it("configureVertexModels merges additional catalog entries in extend mode", () => {
    configureVertexModels({
      additionalCatalog: [{id: "partner-model-v1", label: "Partner Model", provider: "gemini"}],
      catalogMode: "extend",
      isAnthropicEnabled: () => false,
      isMaasEnabled: () => false,
    });

    const ids = getEnabledVertexModelCatalog().map((entry) => entry.id);
    expect(ids).toContain("gemini-3.5-flash");
    expect(ids).toContain("partner-model-v1");
  });

  it("needsAnthropicProvider when replace catalog has only custom anthropic models", () => {
    configureVertexModels({
      allowUnknownAnthropicModels: false,
      allowUnknownGeminiModels: false,
      catalog: [
        {
          id: "claude-opus-4-6",
          label: "Claude Opus 4.6 (Vertex)",
          provider: "anthropic",
          requiresFeatureFlag: "anthropic",
        },
      ],
      catalogMode: "replace",
      isAnthropicEnabled: () => true,
      isMaasEnabled: () => false,
    });

    const registry = getVertexModelRegistry();
    expect(registry.needsAnthropicProvider()).toBe(true);
    expect(registry.needsMaasProvider()).toBe(false);
    expect(isVertexModelAllowed("claude-opus-4-6")).toBe(true);
    expect(isVertexModelAllowed("claude-sonnet-4-6")).toBe(false);
  });

  it("buildGptModelsResponseData falls back when default is not enabled", () => {
    const registry = createVertexModelRegistry({
      catalog: [
        {
          id: "claude-opus-4-6",
          label: "Claude Opus 4.6 (Vertex)",
          provider: "anthropic",
          requiresFeatureFlag: "anthropic",
        },
      ],
      catalogMode: "replace",
      defaultModelId: "gemini-3.5-flash",
      isAnthropicEnabled: () => true,
      isMaasEnabled: () => false,
      titleModelId: "gemini-3.1-flash-lite",
    });

    const response = buildGptModelsResponseData(registry);
    expect(response.models).toEqual([
      {label: "Claude Opus 4.6 (Vertex)", value: "claude-opus-4-6"},
    ]);
    expect(response.defaultModelId).toBe("claude-opus-4-6");
    expect(response.titleModelId).toBe("claude-opus-4-6");
  });

  it("honors strict allowlist flags from configureVertexModels", () => {
    configureVertexModels({
      allowUnknownAnthropicModels: true,
      allowUnknownGeminiModels: false,
      isAnthropicEnabled: () => true,
      isMaasEnabled: () => false,
    });

    expect(isVertexModelAllowed("gemini-9-experimental")).toBe(false);
    expect(isVertexModelAllowed("claude-custom-2026")).toBe(true);
  });
});
