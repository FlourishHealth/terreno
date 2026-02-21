import {AIService, addAiRoutes as addAiRoutesFromPackage} from "@terreno/ai";
import type {ModelRouterOptions} from "@terreno/api";

let aiServiceInstance: AIService | undefined;

const getAiService = (): AIService => {
  if (!aiServiceInstance) {
    // Lazy import to avoid loading AI SDK at module load time
    // Consuming apps provide their own model - here we use Google's Gemini
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic import for optional dependency
    let createModel: any;
    try {
      const google = require("@ai-sdk/google");
      createModel = google.google;
    } catch {
      throw new Error(
        "Missing @ai-sdk/google dependency. Install it to use AI features, " +
          "or set GEMINI_API_KEY environment variable."
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required for AI features.");
    }

    aiServiceInstance = new AIService({
      model: createModel("gemini-2.5-flash"),
    });
  }
  return aiServiceInstance;
};

export const addAiRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Express Router type mismatch between packages
  router: any,
  // biome-ignore lint/suspicious/noExplicitAny: ModelRouterOptions generic requires document type
  options?: Partial<ModelRouterOptions<any>>
): void => {
  const aiService = getAiService();

  addAiRoutesFromPackage(router, {aiService, openApiOptions: options});
};
