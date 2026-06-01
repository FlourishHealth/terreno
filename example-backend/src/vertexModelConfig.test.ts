import {afterEach, describe, expect, it} from "bun:test";
import {resetVertexModels} from "./api/vertexModels";
import {resetVertexAdminSettings} from "./vertexAdminSettings";
import {
  buildExampleVertexModelRegistryOptions,
  buildVertexAdminSettingsFromAppConfig,
} from "./vertexModelConfig";

describe("vertexModelConfig", () => {
  afterEach(() => {
    resetVertexAdminSettings();
    resetVertexModels();
  });

  it("builds admin settings from vertexAi config document shape", () => {
    const admin = buildVertexAdminSettingsFromAppConfig({
      additionalCatalog: [{id: "partner-v1", label: "Partner", provider: "gemini"}],
      allowUnknownGeminiModels: false,
      catalogMode: "replace",
      defaultModelId: "gemini-2.5-flash",
      enableAnthropicModels: true,
      enabled: true,
      enableMaasModels: false,
      geminiApiKey: "test-key",
      projectId: "my-gcp-project",
      titleModelId: "gemini-2.5-flash",
    });

    expect(admin.enabled).toBe(true);
    expect(admin.projectId).toBe("my-gcp-project");
    expect(admin.enableAnthropicModels).toBe(true);
    expect(admin.allowUnknownGeminiModels).toBe(false);
    expect(admin.catalogMode).toBe("replace");
    expect(admin.additionalCatalog).toEqual([
      {id: "partner-v1", label: "Partner", provider: "gemini"},
    ]);
    expect(admin.geminiApiKey).toBe("test-key");
  });

  it("filters malformed additional catalog entries", () => {
    const admin = buildVertexAdminSettingsFromAppConfig({
      additionalCatalog: [
        {id: "partner-v1", label: "Partner", provider: "gemini"},
        {id: "bad", label: "Bad", provider: "unknown"},
        {label: "Missing id", provider: "gemini"},
      ],
    });

    expect(admin.additionalCatalog).toEqual([
      {id: "partner-v1", label: "Partner", provider: "gemini"},
    ]);
  });

  it("builds registry options from admin settings", () => {
    const admin = buildVertexAdminSettingsFromAppConfig({
      enableAnthropicModels: true,
      enableMaasModels: true,
    });
    const options = buildExampleVertexModelRegistryOptions(admin);

    expect(options.isAnthropicEnabled?.()).toBe(true);
    expect(options.isMaasEnabled?.()).toBe(true);
    expect(options.catalogMode).toBe("extend");
  });
});
