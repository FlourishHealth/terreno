import {beforeEach, describe, expect, it} from "bun:test";

import type {SecretProvider} from "./configurationPlugin";
import {CachingSecretProvider, CompositeSecretProvider, EnvSecretProvider} from "./secretProviders";

describe("EnvSecretProvider", () => {
  beforeEach(() => {
    delete process.env.MY_SECRET_KEY;
  });

  it("resolves from a SCREAMING_SNAKE_CASE env var", async () => {
    process.env.MY_SECRET_KEY = "from-env";
    const provider = new EnvSecretProvider();
    expect(await provider.getSecret("my-secret-key")).toBe("from-env");
  });

  it("returns null when the env var is missing", async () => {
    const provider = new EnvSecretProvider();
    expect(await provider.getSecret("my-secret-key")).toBeNull();
  });

  it("ignores the version parameter", async () => {
    process.env.MY_SECRET_KEY = "value";
    const provider = new EnvSecretProvider();
    expect(await provider.getSecret("my-secret-key", "5")).toBe("value");
  });
});

describe("CompositeSecretProvider", () => {
  it("throws when constructed with no providers", () => {
    expect(() => new CompositeSecretProvider([])).toThrow();
  });

  it("returns the first non-null result", async () => {
    const a: SecretProvider = {getSecret: async () => null, name: "a"};
    const b: SecretProvider = {getSecret: async () => "from-b", name: "b"};
    const c: SecretProvider = {getSecret: async () => "from-c", name: "c"};
    const provider = new CompositeSecretProvider([a, b, c]);
    expect(await provider.getSecret("x")).toBe("from-b");
  });

  it("falls through to the next provider when one throws", async () => {
    const failing: SecretProvider = {
      getSecret: async () => {
        throw new Error("provider down");
      },
      name: "failing",
    };
    const fallback: SecretProvider = {getSecret: async () => "from-fallback", name: "fallback"};
    const provider = new CompositeSecretProvider([failing, fallback]);
    expect(await provider.getSecret("x")).toBe("from-fallback");
  });

  it("returns null when every provider yields null", async () => {
    const a: SecretProvider = {getSecret: async () => null, name: "a"};
    const b: SecretProvider = {getSecret: async () => null, name: "b"};
    const provider = new CompositeSecretProvider([a, b]);
    expect(await provider.getSecret("x")).toBeNull();
  });

  it("forwards the version parameter to each provider", async () => {
    const seen: Array<string | undefined> = [];
    const a: SecretProvider = {
      getSecret: async (_name, version) => {
        seen.push(version);
        return null;
      },
      name: "a",
    };
    const b: SecretProvider = {
      getSecret: async (_name, version) => {
        seen.push(version);
        return "value";
      },
      name: "b",
    };
    const provider = new CompositeSecretProvider([a, b]);
    await provider.getSecret("x", "7");
    expect(seen).toEqual(["7", "7"]);
  });

  it("builds a composite name from the underlying providers", () => {
    const provider = new CompositeSecretProvider([
      {getSecret: async () => null, name: "gcp"},
      {getSecret: async () => null, name: "env"},
    ]);
    expect(provider.name).toBe("composite(gcp,env)");
  });
});

describe("CachingSecretProvider", () => {
  it("memoizes a value within the TTL (single underlying call)", async () => {
    let calls = 0;
    const underlying: SecretProvider = {
      getSecret: async () => {
        calls++;
        return "value";
      },
      name: "underlying",
    };
    const provider = new CachingSecretProvider(underlying, {ttlMs: 10_000});
    expect(await provider.getSecret("x")).toBe("value");
    expect(await provider.getSecret("x")).toBe("value");
    expect(calls).toBe(1);
  });

  it("re-fetches after clear()", async () => {
    let calls = 0;
    const underlying: SecretProvider = {
      getSecret: async () => {
        calls++;
        return `value-${calls}`;
      },
      name: "underlying",
    };
    const provider = new CachingSecretProvider(underlying, {ttlMs: 10_000});
    expect(await provider.getSecret("x")).toBe("value-1");
    provider.clear();
    expect(await provider.getSecret("x")).toBe("value-2");
    expect(calls).toBe(2);
  });

  it("re-fetches after the TTL expires", async () => {
    let calls = 0;
    const underlying: SecretProvider = {
      getSecret: async () => {
        calls++;
        return `value-${calls}`;
      },
      name: "underlying",
    };
    const provider = new CachingSecretProvider(underlying, {ttlMs: 1});
    expect(await provider.getSecret("x")).toBe("value-1");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await provider.getSecret("x")).toBe("value-2");
    expect(calls).toBe(2);
  });

  it("caches different versions independently", async () => {
    const seen: Array<string | undefined> = [];
    const underlying: SecretProvider = {
      getSecret: async (_name, version) => {
        seen.push(version);
        return `v-${version ?? "latest"}`;
      },
      name: "underlying",
    };
    const provider = new CachingSecretProvider(underlying, {ttlMs: 10_000});
    expect(await provider.getSecret("x", "1")).toBe("v-1");
    expect(await provider.getSecret("x", "2")).toBe("v-2");
    // Cached hits, no additional underlying calls.
    expect(await provider.getSecret("x", "1")).toBe("v-1");
    expect(seen).toEqual(["1", "2"]);
  });

  it("clearKey invalidates a single secret", async () => {
    let calls = 0;
    const underlying: SecretProvider = {
      getSecret: async () => {
        calls++;
        return `value-${calls}`;
      },
      name: "underlying",
    };
    const provider = new CachingSecretProvider(underlying, {ttlMs: 10_000});
    await provider.getSecret("x");
    provider.clearKey("x");
    await provider.getSecret("x");
    expect(calls).toBe(2);
  });

  it("caches null results", async () => {
    let calls = 0;
    const underlying: SecretProvider = {
      getSecret: async () => {
        calls++;
        return null;
      },
      name: "underlying",
    };
    const provider = new CachingSecretProvider(underlying, {ttlMs: 10_000});
    expect(await provider.getSecret("missing")).toBeNull();
    expect(await provider.getSecret("missing")).toBeNull();
    expect(calls).toBe(1);
  });
});
