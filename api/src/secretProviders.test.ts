import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";

import type {SecretProvider} from "./configurationPlugin";
import {APIError} from "./errors";
import {
  CachingSecretProvider,
  CompositeSecretProvider,
  EnvSecretProvider,
  GcpSecretProvider,
} from "./secretProviders";

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

describe("GcpSecretProvider", () => {
  interface SecretVersionResponse {
    payload?: {data?: string | Uint8Array};
  }

  const mockAccessSecretVersion = mock(
    () => Promise.resolve([{payload: {data: "secret-value"}}] as SecretVersionResponse[])
  );

  const createMockSecretManagerModule = (overrides?: Record<string, unknown>) => ({
    SecretManagerServiceClient: class {
      accessSecretVersion = mockAccessSecretVersion;
    },
    ...overrides,
  });

  beforeEach(() => {
    mockAccessSecretVersion.mockReset();
    mockAccessSecretVersion.mockImplementation(() =>
      Promise.resolve([{payload: {data: "secret-value"}}] as SecretVersionResponse[])
    );
  });

  afterEach(() => {
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
  });

  it("resolves a short secret name to a full resource path", async () => {
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
    const provider = new GcpSecretProvider({projectId: "my-project"});
    const result = await provider.getSecret("openai-api-key");
    expect(result).toBe("secret-value");
    expect(mockAccessSecretVersion).toHaveBeenCalledWith({
      name: "projects/my-project/secrets/openai-api-key/versions/latest",
    });
  });

  it("resolves a short secret name with an explicit version", async () => {
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
    const provider = new GcpSecretProvider({projectId: "my-project"});
    await provider.getSecret("my-key", "3");
    expect(mockAccessSecretVersion).toHaveBeenCalledWith({
      name: "projects/my-project/secrets/my-key/versions/3",
    });
  });

  it("honours a full resource path without appending a version", async () => {
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
    const provider = new GcpSecretProvider({projectId: "my-project"});
    await provider.getSecret("projects/other/secrets/s/versions/5");
    expect(mockAccessSecretVersion).toHaveBeenCalledWith({
      name: "projects/other/secrets/s/versions/5",
    });
  });

  it("appends version to a full resource path that lacks /versions/", async () => {
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
    const provider = new GcpSecretProvider({projectId: "my-project"});
    await provider.getSecret("projects/other/secrets/s", "7");
    expect(mockAccessSecretVersion).toHaveBeenCalledWith({
      name: "projects/other/secrets/s/versions/7",
    });
  });

  it("returns null and warns when the payload is empty", async () => {
    mockAccessSecretVersion.mockImplementation(() =>
      Promise.resolve([{payload: {}}] as SecretVersionResponse[])
    );
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
    const provider = new GcpSecretProvider({projectId: "p"});
    expect(await provider.getSecret("empty-secret")).toBeNull();
  });

  it("decodes Uint8Array payloads", async () => {
    const encoded = new TextEncoder().encode("binary-secret");
    mockAccessSecretVersion.mockImplementation(() =>
      Promise.resolve([{payload: {data: encoded}}] as SecretVersionResponse[])
    );
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
    const provider = new GcpSecretProvider({projectId: "p"});
    expect(await provider.getSecret("bin")).toBe("binary-secret");
  });

  it("returns null for NOT_FOUND errors (gRPC code 5)", async () => {
    const notFound = Object.assign(new Error("NOT_FOUND"), {code: 5});
    mockAccessSecretVersion.mockImplementation(() => Promise.reject(notFound));
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
    const provider = new GcpSecretProvider({projectId: "p"});
    expect(await provider.getSecret("missing")).toBeNull();
  });

  it("re-throws non-NOT_FOUND errors", async () => {
    const err = new Error("permission denied");
    mockAccessSecretVersion.mockImplementation(() => Promise.reject(err));
    mock.module("@google-cloud/secret-manager", () => createMockSecretManagerModule());
    const provider = new GcpSecretProvider({projectId: "p"});
    await expect(provider.getSecret("forbidden")).rejects.toThrow("permission denied");
  });

  it("throws APIError when SecretManagerServiceClient is missing from module", async () => {
    mock.module("@google-cloud/secret-manager", () => ({
      default: {SecretManagerServiceClient: undefined},
      SecretManagerServiceClient: undefined,
    }));
    const provider = new GcpSecretProvider({projectId: "p"});
    try {
      await provider.getSecret("any");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).title).toContain("SecretManagerServiceClient not found");
    }
  });

  it("caches the client after the first call", async () => {
    let constructorCalls = 0;
    mock.module("@google-cloud/secret-manager", () => ({
      SecretManagerServiceClient: class {
        constructor() {
          constructorCalls++;
        }
        accessSecretVersion = mockAccessSecretVersion;
      },
    }));
    const provider = new GcpSecretProvider({projectId: "p"});
    await provider.getSecret("a");
    await provider.getSecret("b");
    expect(constructorCalls).toBe(1);
  });

  it("resolves SecretManagerServiceClient from default export", async () => {
    mock.module("@google-cloud/secret-manager", () => ({
      default: {
        SecretManagerServiceClient: class {
          accessSecretVersion = mockAccessSecretVersion;
        },
      },
    }));
    const provider = new GcpSecretProvider({projectId: "p"});
    const result = await provider.getSecret("key");
    expect(result).toBe("secret-value");
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
