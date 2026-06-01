import {afterEach, describe, expect, it} from "bun:test";
import {resetVertexModels} from "./api/vertexModels";
import {buildExampleVertexModelRegistryOptions} from "./vertexModelConfig";

const restoreEnvVar = (key: string, original: string | undefined): void => {
  if (original === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = original;
};

describe("vertexModelConfig", () => {
  const envKeys = [
    "GOOGLE_VERTEX_ALLOW_UNKNOWN_ANTHROPIC_MODELS",
    "GOOGLE_VERTEX_ALLOW_UNKNOWN_GEMINI_MODELS",
    "GOOGLE_VERTEX_ALLOW_UNKNOWN_MAAS_MODELS",
    "VERTEX_MODEL_CATALOG_MODE",
    "VERTEX_EXTRA_MODEL_CATALOG_JSON",
    "GOOGLE_VERTEX_DEFAULT_MODEL",
    "GOOGLE_VERTEX_TITLE_MODEL",
    "VERTEX_INCLUDE_DEFAULT_CATALOG",
  ] as const;

  const originalEnv: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of envKeys) {
      restoreEnvVar(key, originalEnv[key]);
    }
    resetVertexModels();
  });

  for (const key of envKeys) {
    originalEnv[key] = process.env[key];
  }

  it("defaults allowUnknownGeminiModels to true when env is unset", () => {
    delete process.env.GOOGLE_VERTEX_ALLOW_UNKNOWN_GEMINI_MODELS;
    expect(buildExampleVertexModelRegistryOptions().allowUnknownGeminiModels).toBe(true);
  });

  it("parses boolean env as true only for true or 1", () => {
    process.env.GOOGLE_VERTEX_ALLOW_UNKNOWN_GEMINI_MODELS = "true";
    expect(buildExampleVertexModelRegistryOptions().allowUnknownGeminiModels).toBe(true);

    process.env.GOOGLE_VERTEX_ALLOW_UNKNOWN_GEMINI_MODELS = "1";
    expect(buildExampleVertexModelRegistryOptions().allowUnknownGeminiModels).toBe(true);

    process.env.GOOGLE_VERTEX_ALLOW_UNKNOWN_GEMINI_MODELS = "";
    expect(buildExampleVertexModelRegistryOptions().allowUnknownGeminiModels).toBe(false);

    process.env.GOOGLE_VERTEX_ALLOW_UNKNOWN_GEMINI_MODELS = "false";
    expect(buildExampleVertexModelRegistryOptions().allowUnknownGeminiModels).toBe(false);
  });

  it("uses replace catalog mode when VERTEX_MODEL_CATALOG_MODE is replace", () => {
    process.env.VERTEX_MODEL_CATALOG_MODE = "replace";
    expect(buildExampleVertexModelRegistryOptions().catalogMode).toBe("replace");

    process.env.VERTEX_MODEL_CATALOG_MODE = "extend";
    expect(buildExampleVertexModelRegistryOptions().catalogMode).toBe("extend");
  });

  it("parses VERTEX_EXTRA_MODEL_CATALOG_JSON when valid", () => {
    process.env.VERTEX_EXTRA_MODEL_CATALOG_JSON = JSON.stringify([
      {id: "partner-v1", label: "Partner", provider: "gemini"},
    ]);
    expect(buildExampleVertexModelRegistryOptions().additionalCatalog).toEqual([
      {id: "partner-v1", label: "Partner", provider: "gemini"},
    ]);
  });

  it("ignores invalid VERTEX_EXTRA_MODEL_CATALOG_JSON", () => {
    process.env.VERTEX_EXTRA_MODEL_CATALOG_JSON = "not-json";
    expect(buildExampleVertexModelRegistryOptions().additionalCatalog).toBeUndefined();

    process.env.VERTEX_EXTRA_MODEL_CATALOG_JSON = JSON.stringify({id: "not-array"});
    expect(buildExampleVertexModelRegistryOptions().additionalCatalog).toBeUndefined();
  });

  it("filters malformed entries from VERTEX_EXTRA_MODEL_CATALOG_JSON", () => {
    process.env.VERTEX_EXTRA_MODEL_CATALOG_JSON = JSON.stringify([
      {id: "partner-v1", label: "Partner", provider: "gemini"},
      {id: "bad", label: "Bad", provider: "unknown"},
      {label: "Missing id", provider: "gemini"},
    ]);
    expect(buildExampleVertexModelRegistryOptions().additionalCatalog).toEqual([
      {id: "partner-v1", label: "Partner", provider: "gemini"},
    ]);
  });

  it("passes through default and title model env vars", () => {
    process.env.GOOGLE_VERTEX_DEFAULT_MODEL = "gemini-2.5-flash";
    process.env.GOOGLE_VERTEX_TITLE_MODEL = "gemini-2.5-flash";
    const options = buildExampleVertexModelRegistryOptions();
    expect(options.defaultModelId).toBe("gemini-2.5-flash");
    expect(options.titleModelId).toBe("gemini-2.5-flash");
  });
});
