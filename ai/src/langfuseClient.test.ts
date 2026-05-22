import {afterEach, describe, expect, it, spyOn} from "bun:test";
import {LangfuseClient} from "@langfuse/client";

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

  it("initLangfuseClient creates a client with the given options", () => {
    const client = initLangfuseClient({publicKey: "pk-test", secretKey: "sk-test"});
    expect(client).toBeInstanceOf(LangfuseClient);
  });

  it("initLangfuseClient uses default baseUrl when not provided", () => {
    const client = initLangfuseClient({publicKey: "pk", secretKey: "sk"});
    expect(client).toBeDefined();
  });

  it("initLangfuseClient respects a custom baseUrl", () => {
    const client = initLangfuseClient({
      baseUrl: "https://custom.langfuse.dev",
      publicKey: "pk",
      secretKey: "sk",
    });
    expect(client).toBeDefined();
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
    const client = initLangfuseClient({publicKey: "pk", secretKey: "sk"});
    const shutdownSpy = spyOn(client, "shutdown").mockResolvedValue(undefined);
    expect(isLangfuseInitialized()).toBe(true);

    await shutdownLangfuseClient();
    expect(isLangfuseInitialized()).toBe(false);
    expect(shutdownSpy).toHaveBeenCalledTimes(1);
    shutdownSpy.mockRestore();
  });

  it("shutdownLangfuseClient is a no-op when not initialized", async () => {
    expect(isLangfuseInitialized()).toBe(false);
    await shutdownLangfuseClient();
    expect(isLangfuseInitialized()).toBe(false);
  });
});
