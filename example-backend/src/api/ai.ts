import {
  AIService,
  addAiRequestsExplorerRoutes,
  addFileRoutes,
  addGptHistoryRoutes,
  addGptRoutes,
  addMcpRoutes,
  FileStorageService,
  MCPService,
} from "@terreno/ai";
import type {ModelRouterOptions} from "@terreno/api";
import {tool} from "ai";
import {z} from "zod";

let aiServiceInstance: AIService | undefined;
let mcpServiceInstance: MCPService | undefined;
let fileStorageServiceInstance: FileStorageService | undefined;

// biome-ignore lint/suspicious/noExplicitAny: Dynamic import for optional dependency
const getGoogleModule = (): any => {
  try {
    return require("@ai-sdk/google");
  } catch {
    return undefined;
  }
};

const getAiService = (): AIService | undefined => {
  if (aiServiceInstance) {
    return aiServiceInstance;
  }

  const google = getGoogleModule();
  if (!google) {
    return undefined;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return undefined;
  }

  aiServiceInstance = new AIService({
    model: google.google("gemini-2.5-flash"),
  });
  return aiServiceInstance;
};

const createModelFromKey = (apiKey: string) => {
  const google = getGoogleModule();
  if (!google) {
    throw new Error("Missing @ai-sdk/google dependency.");
  }
  return google.google("gemini-2.5-flash", {apiKey});
};

const getMcpService = (): MCPService | undefined => {
  if (mcpServiceInstance) {
    return mcpServiceInstance;
  }

  const mcpUrl = process.env.MCP_SERVER_URL;
  if (!mcpUrl) {
    return undefined;
  }

  mcpServiceInstance = new MCPService([
    {
      name: "default",
      transport: {type: "sse", url: mcpUrl},
    },
  ]);

  // Connect asynchronously - don't block startup
  void mcpServiceInstance.connect();
  return mcpServiceInstance;
};

const getFileStorageService = (): FileStorageService | undefined => {
  if (fileStorageServiceInstance) {
    return fileStorageServiceInstance;
  }

  const gcsBucket = process.env.GCS_BUCKET;
  if (!gcsBucket) {
    return undefined;
  }

  fileStorageServiceInstance = new FileStorageService({bucketName: gcsBucket});
  return fileStorageServiceInstance;
};

// Sample tools for demo purposes
const demoTools = {
  get_current_time: tool({
    description: "Get the current date and time",
    execute: async ({timezone}) => {
      const now = new Date();
      return {
        time: now.toLocaleString("en-US", {timeZone: timezone ?? "UTC"}),
        timezone: timezone ?? "UTC",
      };
    },
    parameters: z.object({
      timezone: z.string().optional().describe("IANA timezone name (e.g., America/New_York)"),
    }),
  }),
};

export const addAiRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Express Router type mismatch between packages
  router: any,
  // biome-ignore lint/suspicious/noExplicitAny: ModelRouterOptions generic requires document type
  options?: Partial<ModelRouterOptions<any>>
): void => {
  const aiService = getAiService();
  const mcpService = getMcpService();
  const fileStorageService = getFileStorageService();

  addGptHistoryRoutes(router, options);
  addGptRoutes(router, {
    aiService,
    createModelFn: createModelFromKey,
    demoMode: !aiService,
    maxSteps: 5,
    mcpService,
    openApiOptions: options,
    toolChoice: "auto",
    tools: demoTools,
  });
  addAiRequestsExplorerRoutes(router, {openApiOptions: options});

  if (fileStorageService) {
    addFileRoutes(router, {
      fileStorageService,
      gcsBucket: process.env.GCS_BUCKET ?? "",
      openApiOptions: options,
    });
  }

  if (mcpService) {
    addMcpRoutes(router, {mcpService, openApiOptions: options});
  }
};
