import {afterEach, describe, expect, it} from "bun:test";
import {
  DEFAULT_VERTEX_MODEL_ID,
  getEnabledVertexModelCatalog,
  inferVertexModelProvider,
  isVertexModelAllowed,
  TITLE_VERTEX_MODEL_ID,
} from "./vertexModels";

const restoreEnvVar = (key: string, original: string | undefined): void => {
  if (original === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = original;
};

describe("vertexModels", () => {
  const originalAnthropicFlag = process.env.GOOGLE_VERTEX_ENABLE_ANTHROPIC_MODELS;
  const originalMaasFlag = process.env.GOOGLE_VERTEX_ENABLE_MAAS_MODELS;

  afterEach(() => {
    restoreEnvVar("GOOGLE_VERTEX_ENABLE_ANTHROPIC_MODELS", originalAnthropicFlag);
    restoreEnvVar("GOOGLE_VERTEX_ENABLE_MAAS_MODELS", originalMaasFlag);
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

  it("excludes anthropic and maas catalog entries unless feature flags are set", () => {
    delete process.env.GOOGLE_VERTEX_ENABLE_ANTHROPIC_MODELS;
    delete process.env.GOOGLE_VERTEX_ENABLE_MAAS_MODELS;

    const ids = getEnabledVertexModelCatalog().map((entry) => entry.id);
    expect(ids).toContain("gemini-3.5-flash");
    expect(ids).not.toContain("claude-sonnet-4-6");
    expect(ids).not.toContain("openai/gpt-oss-20b-maas");
  });

  it("includes optional models when feature flags are enabled", () => {
    process.env.GOOGLE_VERTEX_ENABLE_ANTHROPIC_MODELS = "true";
    process.env.GOOGLE_VERTEX_ENABLE_MAAS_MODELS = "true";

    const ids = getEnabledVertexModelCatalog().map((entry) => entry.id);
    expect(ids).toContain("claude-sonnet-4-6");
    expect(ids).toContain("openai/gpt-oss-20b-maas");
  });

  it("blocks catalog anthropic models when feature flag is off", () => {
    delete process.env.GOOGLE_VERTEX_ENABLE_ANTHROPIC_MODELS;
    expect(isVertexModelAllowed("claude-sonnet-4-6")).toBe(false);
    expect(isVertexModelAllowed("gemini-3.1-pro-preview")).toBe(true);
  });

  it("allows unknown gemini-shaped ids for forward compatibility", () => {
    expect(isVertexModelAllowed("gemini-9-experimental")).toBe(true);
    expect(isVertexModelAllowed("claude-custom@20260101")).toBe(false);
  });
});
