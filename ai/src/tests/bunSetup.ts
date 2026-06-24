// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {registerSimpleMongoPreload} from "@terreno/test";

registerSimpleMongoPreload({
  defaultLocalMongoUri: "mongodb://127.0.0.1/terreno-ai-test?&connectTimeoutMS=360000",
  onBeforeEach: async () => {
    const {shutdownLangfuseClient} = await import("../langfuseClient");
    await shutdownLangfuseClient();
  },
  testEnv: {
    tokenIssuer: "terreno-ai.test",
  },
});

// Mock @langfuse/client globally so the real `./langfuseClient` module runs
// without making network calls.
import {mock} from "bun:test";

mock.module("@langfuse/client", () => {
  return {
    LangfuseClient: class FakeLangfuseClient {
      baseUrl: string;
      publicKey: string;
      secretKey: string;
      api = {
        prompts: {
          list: mock(async () => ({
            data: [],
            meta: {limit: 20, page: 1, total: 0, totalPages: 0},
          })),
        },
        trace: {
          get: mock(async (id: string) => ({id, name: "Trace"})),
          list: mock(async () => ({
            data: [],
            meta: {limit: 20, page: 1, total: 0, totalPages: 0},
          })),
        },
      };
      prompt = {
        create: mock(async (_params: Record<string, unknown>) => undefined),
        get: mock(async (name: string) => ({
          config: {},
          labels: [],
          name,
          prompt: "",
          tags: [],
          type: "text" as const,
          version: 1,
        })),
      };
      score = {create: mock(() => {})};
      flush = mock(async () => {});
      shutdown = mock(async () => {});

      constructor(opts: {baseUrl: string; publicKey: string; secretKey: string}) {
        this.baseUrl = opts.baseUrl;
        this.publicKey = opts.publicKey;
        this.secretKey = opts.secretKey;
      }
    },
  };
});
