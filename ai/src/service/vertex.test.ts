import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import type {ImageModel, LanguageModel} from "ai";

import {
  assertVertexModelsEnabled,
  createVertexProvider,
  isVertexModelAllowed,
  listEnabledVertexModels,
  normalizeVertexModelId,
  type VertexLanguageModelProvider,
  verifyVertexModelsEnabled,
} from "./vertex";

const makeLanguageModel = (modelId: string): LanguageModel =>
  ({modelId, provider: "vertex"}) as unknown as LanguageModel;

const makeImageModel = (modelId: string): ImageModel =>
  ({modelId, provider: "vertex"}) as unknown as ImageModel;

const makeVertexFactory = (): ((opts: {
  location: string;
  project: string;
}) => VertexLanguageModelProvider) => {
  return () => {
    const provider = ((modelId: string) =>
      makeLanguageModel(modelId)) as VertexLanguageModelProvider;
    provider.image = (modelId: string) => makeImageModel(modelId);
    return provider;
  };
};

describe("vertex helpers", () => {
  const originalProject = process.env.GOOGLE_VERTEX_PROJECT;
  const originalLocation = process.env.GOOGLE_VERTEX_LOCATION;

  beforeEach(() => {
    delete process.env.GOOGLE_VERTEX_PROJECT;
    delete process.env.GOOGLE_VERTEX_LOCATION;
  });

  afterEach(() => {
    if (originalProject === undefined) {
      delete process.env.GOOGLE_VERTEX_PROJECT;
    } else {
      process.env.GOOGLE_VERTEX_PROJECT = originalProject;
    }
    if (originalLocation === undefined) {
      delete process.env.GOOGLE_VERTEX_LOCATION;
    } else {
      process.env.GOOGLE_VERTEX_LOCATION = originalLocation;
    }
  });

  describe("normalizeVertexModelId", () => {
    it("strips publisher resource prefixes", () => {
      expect(normalizeVertexModelId("publishers/google/models/gemini-2.5-flash")).toBe(
        "gemini-2.5-flash"
      );
    });

    it("strips version suffixes", () => {
      expect(normalizeVertexModelId("gemini-2.5-pro@001")).toBe("gemini-2.5-pro");
    });

    it("returns bare ids unchanged", () => {
      expect(normalizeVertexModelId("gemini-2.5-flash")).toBe("gemini-2.5-flash");
    });
  });

  describe("isVertexModelAllowed", () => {
    it("allows all models when no allow-list is set", () => {
      expect(isVertexModelAllowed("any-model")).toBe(true);
      expect(isVertexModelAllowed("any-model", [])).toBe(true);
    });

    it("restricts to listed models when an allow-list is provided", () => {
      expect(isVertexModelAllowed("gemini-2.5-flash", ["gemini-2.5-flash"])).toBe(true);
      expect(isVertexModelAllowed("gemini-2.5-pro", ["gemini-2.5-flash"])).toBe(false);
    });
  });

  describe("createVertexProvider", () => {
    it("returns undefined when no project is configured", () => {
      const provider = createVertexProvider({vertexFactory: makeVertexFactory()});
      expect(provider).toBeUndefined();
    });

    it("permits all models by default", () => {
      const provider = createVertexProvider({
        project: "demo-project",
        vertexFactory: makeVertexFactory(),
      });
      expect(provider).toBeDefined();
      expect(provider?.allowedModels).toBeUndefined();
      expect(provider?.isModelAllowed("gemini-anything")).toBe(true);
      expect(provider?.languageModel("gemini-anything")).toBeDefined();
    });

    it("defaults location from env then us-central1", () => {
      const withDefault = createVertexProvider({
        project: "demo-project",
        vertexFactory: makeVertexFactory(),
      });
      expect(withDefault?.location).toBe("us-central1");

      const withExplicit = createVertexProvider({
        location: "europe-west1",
        project: "demo-project",
        vertexFactory: makeVertexFactory(),
      });
      expect(withExplicit?.location).toBe("europe-west1");
    });

    it("enforces the allow-list when provided", () => {
      const provider = createVertexProvider({
        allowedModels: ["gemini-2.5-flash"],
        project: "demo-project",
        vertexFactory: makeVertexFactory(),
      });
      expect(provider?.isModelAllowed("gemini-2.5-flash")).toBe(true);
      expect(provider?.isModelAllowed("gemini-2.5-pro")).toBe(false);
      expect(provider?.languageModel("gemini-2.5-flash")).toBeDefined();
      expect(() => provider?.languageModel("gemini-2.5-pro")).toThrow();
      expect(() => provider?.imageModel("imagen-4.0-fast-generate-001")).toThrow();
    });
  });

  describe("verifyVertexModelsEnabled", () => {
    it("marks models available/unavailable based on the listing", async () => {
      const result = await verifyVertexModelsEnabled({
        listModelsFn: mock(async () => ["gemini-2.5-flash", "gemini-2.0-flash-lite"]),
        models: ["gemini-2.5-flash", "gemini-2.5-pro"],
        project: "demo-project",
      });
      expect(result.checked).toBe(true);
      expect(result.available).toEqual(["gemini-2.5-flash"]);
      expect(result.unavailable).toEqual(["gemini-2.5-pro"]);
    });

    it("returns checked=false when the listing is unavailable", async () => {
      const result = await verifyVertexModelsEnabled({
        listModelsFn: mock(async () => undefined),
        models: ["gemini-2.5-flash"],
        project: "demo-project",
      });
      expect(result.checked).toBe(false);
      expect(result.available).toEqual(["gemini-2.5-flash"]);
      expect(result.unavailable).toEqual([]);
    });
  });

  describe("assertVertexModelsEnabled", () => {
    it("throws when a requested model is not enabled", async () => {
      await expect(
        assertVertexModelsEnabled({
          listModelsFn: mock(async () => ["gemini-2.5-flash"]),
          models: ["gemini-2.5-pro"],
          project: "demo-project",
        })
      ).rejects.toThrow();
    });

    it("does not throw when verification is inconclusive", async () => {
      const result = await assertVertexModelsEnabled({
        listModelsFn: mock(async () => undefined),
        models: ["gemini-2.5-pro"],
        project: "demo-project",
      });
      expect(result.checked).toBe(false);
    });
  });

  describe("listEnabledVertexModels", () => {
    it("paginates and normalizes publisher model names", async () => {
      const fetchImpl = mock(async (input: string | URL) => {
        const url = new URL(input.toString());
        const isSecondPage = url.searchParams.get("pageToken") === "page-2";
        const body = isSecondPage
          ? {publisherModels: [{name: "publishers/google/models/gemini-2.5-pro"}]}
          : {
              nextPageToken: "page-2",
              publisherModels: [{name: "publishers/google/models/gemini-2.5-flash"}],
            };
        return {
          json: async () => body,
          ok: true,
          status: 200,
        } as unknown as Response;
      });

      const models = await listEnabledVertexModels({
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessToken: async () => "fake-token",
        location: "us-central1",
        project: "demo-project",
      });
      expect(models).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("returns undefined when no access token is available", async () => {
      const models = await listEnabledVertexModels({
        fetchImpl: mock(async () => ({}) as unknown as Response) as unknown as typeof fetch,
        getAccessToken: async () => undefined,
        project: "demo-project",
      });
      expect(models).toBeUndefined();
    });

    it("returns undefined when the listing request fails", async () => {
      const models = await listEnabledVertexModels({
        fetchImpl: mock(
          async () => ({json: async () => ({}), ok: false, status: 403}) as unknown as Response
        ) as unknown as typeof fetch,
        getAccessToken: async () => "fake-token",
        project: "demo-project",
      });
      expect(models).toBeUndefined();
    });
  });
});
