import {afterEach, beforeEach, describe, expect, it} from "bun:test";

import {
  getLangfuseClient,
  initLangfuseClient,
  isLangfuseInitialized,
  shutdownLangfuseClient,
} from "./langfuseClient";

describe("langfuseClient", () => {
  beforeEach(async () => {
    await shutdownLangfuseClient();
  });

  afterEach(async () => {
    await shutdownLangfuseClient();
  });

  describe("initLangfuseClient", () => {
    it("returns a LangfuseClient instance", () => {
      const client = initLangfuseClient({
        publicKey: "pk-test",
        secretKey: "sk-test",
      });
      expect(client).toBeDefined();
    });

    it("overwrites the previous client on re-initialization", () => {
      const first = initLangfuseClient({
        publicKey: "pk-test",
        secretKey: "sk-test",
      });
      const second = initLangfuseClient({
        publicKey: "pk-test-2",
        secretKey: "sk-test-2",
      });
      expect(second).not.toBe(first);
      expect(getLangfuseClient()).toBe(second);
    });

    it("accepts a custom baseUrl", () => {
      const client = initLangfuseClient({
        baseUrl: "https://custom.langfuse.com",
        publicKey: "pk-test",
        secretKey: "sk-test",
      });
      expect(client).toBeDefined();
    });
  });

  describe("getLangfuseClient", () => {
    it("throws when client is not initialized", () => {
      expect(() => getLangfuseClient()).toThrow(
        "Langfuse client not initialized. Call initLangfuseClient first."
      );
    });

    it("returns the initialized client", () => {
      const initialized = initLangfuseClient({
        publicKey: "pk-test",
        secretKey: "sk-test",
      });
      const retrieved = getLangfuseClient();
      expect(retrieved).toBe(initialized);
    });
  });

  describe("isLangfuseInitialized", () => {
    it("returns false before initialization", () => {
      expect(isLangfuseInitialized()).toBe(false);
    });

    it("returns true after initialization", () => {
      initLangfuseClient({publicKey: "pk-test", secretKey: "sk-test"});
      expect(isLangfuseInitialized()).toBe(true);
    });

    it("returns false after shutdown", async () => {
      initLangfuseClient({publicKey: "pk-test", secretKey: "sk-test"});
      await shutdownLangfuseClient();
      expect(isLangfuseInitialized()).toBe(false);
    });
  });

  describe("shutdownLangfuseClient", () => {
    it("is a no-op when client is not initialized", async () => {
      await expect(shutdownLangfuseClient()).resolves.toBeUndefined();
    });

    it("shuts down the client and clears the instance", async () => {
      initLangfuseClient({publicKey: "pk-test", secretKey: "sk-test"});
      expect(isLangfuseInitialized()).toBe(true);
      await shutdownLangfuseClient();
      expect(isLangfuseInitialized()).toBe(false);
    });

    it("causes getLangfuseClient to throw after shutdown", async () => {
      initLangfuseClient({publicKey: "pk-test", secretKey: "sk-test"});
      await shutdownLangfuseClient();
      expect(() => getLangfuseClient()).toThrow(
        "Langfuse client not initialized. Call initLangfuseClient first."
      );
    });
  });
});
