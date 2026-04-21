import {afterAll, afterEach, beforeEach, describe, expect, it, mock} from "bun:test";

type ExpoOptions = {
  scheme?: string;
  storagePrefix?: string;
  storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  };
};

const captured: {expo: ExpoOptions | null; auth: Record<string, unknown> | null} = {
  auth: null,
  expo: null,
};

mock.module("@better-auth/expo/client", () => ({
  expoClient: (options: ExpoOptions) => {
    captured.expo = options;
    return {name: "expo-plugin"};
  },
}));

mock.module("better-auth/react", () => ({
  createAuthClient: (config: Record<string, unknown>) => {
    captured.auth = config;
    return {clientId: "mock-client", config};
  },
}));

const secureCalls = {
  delete: [] as string[],
  get: [] as string[],
  set: [] as Array<[string, string]>,
};
const resetSecureCalls = (): void => {
  secureCalls.delete = [];
  secureCalls.get = [];
  secureCalls.set = [];
};

mock.module("expo-secure-store", () => ({
  deleteItemAsync: async (key: string): Promise<void> => {
    secureCalls.delete.push(key);
  },
  getItemAsync: async (key: string): Promise<string | null> => {
    secureCalls.get.push(key);
    return `secure-${key}`;
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    secureCalls.set.push([key, value]);
  },
}));

const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
const {createBetterAuthClient, createStorageAdapter} = await import("./betterAuthClient");

describe("createStorageAdapter (web)", () => {
  const globalWithWindow = globalThis as {window?: unknown};
  const originalGet = AsyncStorage.getItem;
  const originalSet = AsyncStorage.setItem;
  const originalRemove = AsyncStorage.removeItem;
  const calls = {get: [] as string[], remove: [] as string[], set: [] as Array<[string, string]>};
  let originalWindow: unknown;

  beforeEach(() => {
    originalWindow = globalWithWindow.window;
    calls.get = [];
    calls.remove = [];
    calls.set = [];
    AsyncStorage.getItem = async (key: string): Promise<string | null> => {
      calls.get.push(key);
      return `async-${key}`;
    };
    AsyncStorage.setItem = async (key: string, value: string): Promise<void> => {
      calls.set.push([key, value]);
    };
    AsyncStorage.removeItem = async (key: string): Promise<void> => {
      calls.remove.push(key);
    };
  });

  afterEach(() => {
    AsyncStorage.getItem = originalGet;
    AsyncStorage.setItem = originalSet;
    AsyncStorage.removeItem = originalRemove;
    if (typeof originalWindow === "undefined") {
      delete globalWithWindow.window;
    } else {
      globalWithWindow.window = originalWindow;
    }
  });

  it("reads, writes, and removes via AsyncStorage when window exists", async () => {
    globalWithWindow.window = {};
    const adapter = createStorageAdapter(true);
    await expect(adapter.getItem("k")).resolves.toBe("async-k");
    await adapter.setItem("a", "b");
    await adapter.removeItem?.("c");
    expect(calls.get).toEqual(["k"]);
    expect(calls.set).toEqual([["a", "b"]]);
    expect(calls.remove).toEqual(["c"]);
  });

  it("returns null/void without touching AsyncStorage in SSR (no window)", async () => {
    delete globalWithWindow.window;
    const adapter = createStorageAdapter(true);
    await expect(adapter.getItem("k")).resolves.toBeNull();
    await expect(adapter.setItem("a", "b")).resolves.toBeUndefined();
    await expect(adapter.removeItem?.("c")).resolves.toBeUndefined();
    expect(calls.get).toEqual([]);
    expect(calls.set).toEqual([]);
    expect(calls.remove).toEqual([]);
  });
});

describe("createStorageAdapter (native)", () => {
  beforeEach(() => {
    resetSecureCalls();
  });

  it("routes reads, writes, and deletes through SecureStore", async () => {
    const adapter = createStorageAdapter(false);
    await expect(adapter.getItem("auth")).resolves.toBe("secure-auth");
    await adapter.setItem("auth", "token");
    await adapter.removeItem?.("auth");
    expect(secureCalls.get).toEqual(["auth"]);
    expect(secureCalls.set).toEqual([["auth", "token"]]);
    expect(secureCalls.delete).toEqual(["auth"]);
  });
});

describe("createBetterAuthClient", () => {
  afterAll(() => {
    // Restore the test-preload mocks so later test files aren't polluted.
    mock.module("@better-auth/expo/client", () => ({
      expoClient: () => ({name: "expo-plugin"}),
    }));
    mock.module("better-auth/react", () => ({
      createAuthClient: () => ({}),
    }));
    mock.module("expo-secure-store", () => ({
      deleteItemAsync: async () => {},
      getItemAsync: async () => null,
      setItemAsync: async () => {},
    }));
  });

  it("passes baseURL and scheme through to the Better Auth client", () => {
    captured.auth = null;
    captured.expo = null;
    const client = createBetterAuthClient({
      baseURL: "http://localhost:3000",
      scheme: "terreno",
    });
    expect(captured.auth).not.toBeNull();
    expect(captured.auth?.baseURL).toBe("http://localhost:3000");
    expect(captured.expo?.scheme).toBe("terreno");
    expect(captured.expo?.storagePrefix).toBe("terreno");
    expect(captured.expo?.storage).toBeDefined();
    expect(client).toBeDefined();
  });

  it("uses a custom storagePrefix when provided", () => {
    captured.auth = null;
    captured.expo = null;
    createBetterAuthClient({
      baseURL: "http://localhost:3000",
      scheme: "terreno",
      storagePrefix: "custom",
    });
    expect(captured.expo?.storagePrefix).toBe("custom");
  });
});
