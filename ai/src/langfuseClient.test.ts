import {afterEach, describe, expect, it, mock} from "bun:test";

import {
  getLangfuseClient,
  initLangfuseClient,
  isLangfuseInitialized,
  shutdownLangfuseClient,
} from "./langfuseClient";

mock.module("@langfuse/client", () => {
  return {
    LangfuseClient: class MockLangfuseClient {
      baseUrl: string;
      publicKey: string;
      secretKey: string;

      constructor(opts: {baseUrl: string; publicKey: string; secretKey: string}) {
        this.baseUrl = opts.baseUrl;
        this.publicKey = opts.publicKey;
        this.secretKey = opts.secretKey;
      }

      shutdown = mock(async () => {});
    },
  };
});

describe("langfuseClient", () => {
  afterEach(async () => {
    await shutdownLangfuseClient();
  });

  it("throws when getLangfuseClient is called before init", () => {
    expect(() => getLangfuseClient()).toThrow(
      "Langfuse client not initialized. Call initLangfuseClient first."
    );
  });

  it("isLangfuseInitialized returns false before init", () => {
    expect(isLangfuseInitialized()).toBe(false);
  });

  it("initLangfuseClient creates and returns a client", () => {
    const client = initLangfuseClient({
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
    expect(client).toBeDefined();
  });

  it("uses default baseUrl when not provided", () => {
    const client = initLangfuseClient({
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
    expect((client as any).baseUrl).toBe("https://cloud.langfuse.com");
  });

  it("uses custom baseUrl when provided", () => {
    const client = initLangfuseClient({
      baseUrl: "https://custom.langfuse.com",
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
    expect((client as any).baseUrl).toBe("https://custom.langfuse.com");
  });

  it("isLangfuseInitialized returns true after init", () => {
    initLangfuseClient({publicKey: "pk-test", secretKey: "sk-test"});
    expect(isLangfuseInitialized()).toBe(true);
  });

  it("getLangfuseClient returns the initialized client", () => {
    const created = initLangfuseClient({publicKey: "pk-test", secretKey: "sk-test"});
    const retrieved = getLangfuseClient();
    expect(retrieved).toBe(created);
  });

  it("shutdownLangfuseClient shuts down and nullifies the instance", async () => {
    const client = initLangfuseClient({publicKey: "pk-test", secretKey: "sk-test"});
    expect(isLangfuseInitialized()).toBe(true);
    await shutdownLangfuseClient();
    expect(isLangfuseInitialized()).toBe(false);
    expect(client.shutdown).toHaveBeenCalled();
  });

  it("shutdownLangfuseClient is a no-op when not initialized", async () => {
    expect(isLangfuseInitialized()).toBe(false);
    await shutdownLangfuseClient();
    expect(isLangfuseInitialized()).toBe(false);
  });
});
