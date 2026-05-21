import {afterEach, describe, expect, it, mock} from "bun:test";

// Track calls to the LangfuseClient constructor and shutdown
const constructorCalls: Array<{baseUrl: string; publicKey: string; secretKey: string}> = [];
const shutdownCalls: number[] = [];

mock.module("@langfuse/client", () => ({
  LangfuseClient: class MockLangfuseClient {
    constructor(opts: {baseUrl: string; publicKey: string; secretKey: string}) {
      constructorCalls.push(opts);
    }
    shutdown = mock(async () => {
      shutdownCalls.push(1);
    });
  },
}));

const {getLangfuseClient, initLangfuseClient, isLangfuseInitialized, shutdownLangfuseClient} =
  await import("./langfuseClient");

describe("langfuseClient", () => {
  afterEach(async () => {
    // Reset to uninitialized state between tests
    await shutdownLangfuseClient();
    constructorCalls.length = 0;
    shutdownCalls.length = 0;
  });

  it("initLangfuseClient creates a client with the given options", () => {
    const client = initLangfuseClient({
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
    expect(client).toBeDefined();
    expect(constructorCalls.length).toBe(1);
    expect(constructorCalls[0]).toEqual({
      baseUrl: "https://cloud.langfuse.com",
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
  });

  it("initLangfuseClient respects a custom baseUrl", () => {
    initLangfuseClient({
      baseUrl: "https://custom.langfuse.dev",
      publicKey: "pk",
      secretKey: "sk",
    });
    expect(constructorCalls[0].baseUrl).toBe("https://custom.langfuse.dev");
  });

  it("getLangfuseClient throws when not initialized", () => {
    expect(() => getLangfuseClient()).toThrow(
      "Langfuse client not initialized. Call initLangfuseClient first."
    );
  });

  it("getLangfuseClient returns the initialized client", () => {
    const created = initLangfuseClient({publicKey: "pk", secretKey: "sk"});
    const retrieved = getLangfuseClient();
    expect(retrieved).toBe(created);
  });

  it("isLangfuseInitialized returns false before init and true after", () => {
    expect(isLangfuseInitialized()).toBe(false);
    initLangfuseClient({publicKey: "pk", secretKey: "sk"});
    expect(isLangfuseInitialized()).toBe(true);
  });

  it("shutdownLangfuseClient calls shutdown and resets state", async () => {
    initLangfuseClient({publicKey: "pk", secretKey: "sk"});
    expect(isLangfuseInitialized()).toBe(true);

    await shutdownLangfuseClient();
    expect(isLangfuseInitialized()).toBe(false);
    expect(shutdownCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("shutdownLangfuseClient is a no-op when not initialized", async () => {
    shutdownCalls.length = 0;
    await shutdownLangfuseClient();
    expect(shutdownCalls.length).toBe(0);
    expect(isLangfuseInitialized()).toBe(false);
  });
});
