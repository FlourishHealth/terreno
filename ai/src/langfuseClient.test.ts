import {afterEach, describe, expect, it} from "bun:test";

import {
  getLangfuseClient,
  initLangfuseClient,
  isLangfuseInitialized,
  shutdownLangfuseClient,
} from "./langfuseClient";

describe("langfuseClient", () => {
  afterEach(async () => {
    await shutdownLangfuseClient();
  });

  it("throws when getLangfuseClient is called before initialization", () => {
    expect(() => getLangfuseClient()).toThrow(
      "Langfuse client not initialized. Call initLangfuseClient first."
    );
  });

  it("isLangfuseInitialized returns false before initialization", () => {
    expect(isLangfuseInitialized()).toBe(false);
  });

  it("initLangfuseClient creates and returns a client", () => {
    const client = initLangfuseClient({
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
    expect(client).toBeDefined();
    expect(isLangfuseInitialized()).toBe(true);
  });

  it("getLangfuseClient returns the initialized client", () => {
    const initialized = initLangfuseClient({
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
    const retrieved = getLangfuseClient();
    expect(retrieved).toBe(initialized);
  });

  it("initLangfuseClient accepts a custom baseUrl", () => {
    const client = initLangfuseClient({
      baseUrl: "https://custom.langfuse.com",
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
    expect(client).toBeDefined();
  });

  it("shutdownLangfuseClient resets the instance", async () => {
    initLangfuseClient({
      publicKey: "pk-test",
      secretKey: "sk-test",
    });
    expect(isLangfuseInitialized()).toBe(true);
    await shutdownLangfuseClient();
    expect(isLangfuseInitialized()).toBe(false);
    expect(() => getLangfuseClient()).toThrow();
  });

  it("shutdownLangfuseClient is a no-op when not initialized", async () => {
    expect(isLangfuseInitialized()).toBe(false);
    await shutdownLangfuseClient();
    expect(isLangfuseInitialized()).toBe(false);
  });
});
