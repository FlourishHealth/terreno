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

// ---------------------------------------------------------------------------
// GcpSecretProvider
// ---------------------------------------------------------------------------

interface MockSecretManagerClient {
  accessSecretVersion: (request: {
    name: string;
  }) => Promise<[{payload?: {data?: string | Uint8Array}}]>;
}

/** Inject a pre-built mock client into a GcpSecretProvider, bypassing getClient(). */
const injectClient = (provider: GcpSecretProvider, client: MockSecretManagerClient): void => {
  // Bypass the private `client` field for testing — avoids the dynamic import of
  // @google-cloud/secret-manager which is an optional peer dependency.
  Object.defineProperty(provider, "client", {configurable: true, value: client, writable: true});
};

describe("GcpSecretProvider", () => {
  it("has the name 'gcp'", () => {
    const provider = new GcpSecretProvider({projectId: "my-project"});
    expect(provider.name).toBe("gcp");
  });

  it("throws APIError when @google-cloud/secret-manager is not installed", async () => {
    const provider = new GcpSecretProvider({projectId: "my-project"});
    try {
      await provider.getSecret("some-secret");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).title).toContain(
        "GcpSecretProvider requires @google-cloud/secret-manager"
      );
    }
  });

  it("resolves a short secret name to the full resource path with default version", async () => {
    const calls: string[] = [];
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async (req) => {
        calls.push(req.name);
        return [{payload: {data: "secret-value"}}];
      },
    };
    const provider = new GcpSecretProvider({projectId: "my-project"});
    injectClient(provider, mockClient);

    const result = await provider.getSecret("openai-api-key");
    expect(result).toBe("secret-value");
    expect(calls).toEqual(["projects/my-project/secrets/openai-api-key/versions/latest"]);
  });

  it("resolves a short secret name with an explicit version", async () => {
    const calls: string[] = [];
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async (req) => {
        calls.push(req.name);
        return [{payload: {data: "v3-value"}}];
      },
    };
    const provider = new GcpSecretProvider({projectId: "p"});
    injectClient(provider, mockClient);

    const result = await provider.getSecret("my-key", "3");
    expect(result).toBe("v3-value");
    expect(calls).toEqual(["projects/p/secrets/my-key/versions/3"]);
  });

  it("honors a full resource path that already contains /versions/", async () => {
    const calls: string[] = [];
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async (req) => {
        calls.push(req.name);
        return [{payload: {data: "pinned"}}];
      },
    };
    const provider = new GcpSecretProvider({projectId: "ignored"});
    injectClient(provider, mockClient);

    const result = await provider.getSecret("projects/p/secrets/s/versions/7");
    expect(result).toBe("pinned");
    expect(calls).toEqual(["projects/p/secrets/s/versions/7"]);
  });

  it("appends /versions/latest to a full resource path without a version suffix", async () => {
    const calls: string[] = [];
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async (req) => {
        calls.push(req.name);
        return [{payload: {data: "latest-value"}}];
      },
    };
    const provider = new GcpSecretProvider({projectId: "ignored"});
    injectClient(provider, mockClient);

    const result = await provider.getSecret("projects/p/secrets/s");
    expect(result).toBe("latest-value");
    expect(calls).toEqual(["projects/p/secrets/s/versions/latest"]);
  });

  it("appends the explicit version when full path lacks /versions/", async () => {
    const calls: string[] = [];
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async (req) => {
        calls.push(req.name);
        return [{payload: {data: "v5"}}];
      },
    };
    const provider = new GcpSecretProvider({projectId: "ignored"});
    injectClient(provider, mockClient);

    const result = await provider.getSecret("projects/p/secrets/s", "5");
    expect(result).toBe("v5");
    expect(calls).toEqual(["projects/p/secrets/s/versions/5"]);
  });

  it("decodes a Uint8Array payload", async () => {
    const encoded = new TextEncoder().encode("binary-secret");
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async () => [{payload: {data: encoded}}],
    };
    const provider = new GcpSecretProvider({projectId: "p"});
    injectClient(provider, mockClient);

    expect(await provider.getSecret("bin-key")).toBe("binary-secret");
  });

  it("returns null when the payload is empty", async () => {
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async () => [{payload: {}}],
    };
    const provider = new GcpSecretProvider({projectId: "p"});
    injectClient(provider, mockClient);

    expect(await provider.getSecret("empty-payload")).toBeNull();
  });

  it("returns null when the payload field is missing entirely", async () => {
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async () => [{}],
    };
    const provider = new GcpSecretProvider({projectId: "p"});
    injectClient(provider, mockClient);

    expect(await provider.getSecret("no-payload")).toBeNull();
  });

  it("returns null on NOT_FOUND (gRPC code 5)", async () => {
    const notFound = Object.assign(new Error("NOT_FOUND"), {code: 5});
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async () => {
        throw notFound;
      },
    };
    const provider = new GcpSecretProvider({projectId: "p"});
    injectClient(provider, mockClient);

    expect(await provider.getSecret("missing-secret")).toBeNull();
  });

  it("re-throws non-NOT_FOUND errors", async () => {
    const permissionDenied = Object.assign(new Error("PERMISSION_DENIED"), {code: 7});
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async () => {
        throw permissionDenied;
      },
    };
    const provider = new GcpSecretProvider({projectId: "p"});
    injectClient(provider, mockClient);

    try {
      await provider.getSecret("forbidden-secret");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBe(permissionDenied);
    }
  });

  it("re-throws non-Error throwables", async () => {
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async () => {
        throw "string-error";
      },
    };
    const provider = new GcpSecretProvider({projectId: "p"});
    injectClient(provider, mockClient);

    try {
      await provider.getSecret("x");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBe("string-error");
    }
  });

  it("caches the client across multiple getSecret calls", async () => {
    let callCount = 0;
    const mockClient: MockSecretManagerClient = {
      accessSecretVersion: async () => {
        callCount++;
        return [{payload: {data: `call-${callCount}`}}];
      },
    };
    const provider = new GcpSecretProvider({projectId: "p"});
    injectClient(provider, mockClient);

    expect(await provider.getSecret("a")).toBe("call-1");
    expect(await provider.getSecret("b")).toBe("call-2");
    expect(callCount).toBe(2);
  });
});
