import {describe, expect, it, mock} from "bun:test";

import {listGeminiApiModels, normalizeGeminiModelId} from "./gemini";

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    json: async () => body,
    ok,
    status,
  }) as unknown as Response;

describe("gemini model listing helpers", () => {
  describe("normalizeGeminiModelId", () => {
    it("strips the models/ prefix", () => {
      expect(normalizeGeminiModelId("models/gemini-2.5-flash")).toBe("gemini-2.5-flash");
    });

    it("leaves a bare id unchanged", () => {
      expect(normalizeGeminiModelId("gemini-2.5-pro")).toBe("gemini-2.5-pro");
    });
  });

  describe("listGeminiApiModels", () => {
    it("returns undefined when no api key is provided", async () => {
      const result = await listGeminiApiModels({apiKey: ""});
      expect(result).toBeUndefined();
    });

    it("returns normalized chat model ids and filters out non-generateContent models", async () => {
      const fetchImpl = mock(async () =>
        jsonResponse({
          models: [
            {name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"]},
            {name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"]},
            {name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"]},
          ],
        })
      ) as unknown as typeof fetch;

      const result = await listGeminiApiModels({apiKey: "key", fetchImpl});
      expect(result).toEqual(["gemini-2.5-pro", "gemini-2.5-flash"]);
    });

    it("returns every model when chatOnly is false", async () => {
      const fetchImpl = mock(async () =>
        jsonResponse({
          models: [
            {name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"]},
            {name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"]},
          ],
        })
      ) as unknown as typeof fetch;

      const result = await listGeminiApiModels({apiKey: "key", chatOnly: false, fetchImpl});
      expect(result).toEqual(["gemini-2.5-flash", "text-embedding-004"]);
    });

    it("follows pagination via nextPageToken", async () => {
      let call = 0;
      const fetchImpl = mock(async () => {
        call += 1;
        if (call === 1) {
          return jsonResponse({
            models: [
              {name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"]},
            ],
            nextPageToken: "page2",
          });
        }
        return jsonResponse({
          models: [
            {name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"]},
          ],
        });
      }) as unknown as typeof fetch;

      const result = await listGeminiApiModels({apiKey: "key", fetchImpl});
      expect(result).toEqual(["gemini-2.5-pro", "gemini-2.5-flash"]);
      expect(call).toBe(2);
    });

    it("returns undefined when the request fails", async () => {
      const fetchImpl = mock(async () => jsonResponse({}, false, 503)) as unknown as typeof fetch;
      const result = await listGeminiApiModels({apiKey: "key", fetchImpl});
      expect(result).toBeUndefined();
    });

    it("returns undefined when fetch throws", async () => {
      const fetchImpl = mock(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch;
      const result = await listGeminiApiModels({apiKey: "key", fetchImpl});
      expect(result).toBeUndefined();
    });
  });
});
