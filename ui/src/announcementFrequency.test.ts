import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import {DateTime} from "luxon";

import {
  type AnnouncementFrequencyDeps,
  buildFrequencyStorageKey,
  createFrequencySessionState,
  type FrequencyStorage,
  getFrequencyStorageNamespace,
  recordInterruptShown,
  resetFrequencySessionStateForTests,
  resolveFrequencyConfig,
  shouldSuppressInterrupt,
} from "./announcementFrequency";

const createMemoryStorage = (initial: Record<string, string> = {}): FrequencyStorage => {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: async (key: string): Promise<string | null> => {
      return store.get(key) ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      store.set(key, value);
    },
  };
};

const createDeps = (
  overrides: Partial<AnnouncementFrequencyDeps> & {storage?: FrequencyStorage} = {}
): AnnouncementFrequencyDeps => {
  const session = overrides.session ?? createFrequencySessionState();
  const storage = overrides.storage ?? createMemoryStorage();
  const clock = overrides.clock ?? {
    now: (): DateTime => DateTime.fromISO("2026-09-15T12:00:00.000Z", {zone: "utc"}),
  };
  const warnings: Array<{message: string; details?: unknown}> = [];
  const warn =
    overrides.warn ??
    ((message: string, details?: unknown): void => {
      warnings.push({details, message});
    });
  return {clock, session, storage, warn, ...overrides};
};

describe("announcementFrequency", () => {
  beforeEach(() => {
    resetFrequencySessionStateForTests();
  });

  describe("resolveFrequencyConfig", () => {
    it("defaults maxInterruptionsPerSession to 1, cooldown off, and skipFirstLaunch false", () => {
      const resolved = resolveFrequencyConfig();
      assert.strictEqual(resolved.maxInterruptionsPerSession, 1);
      assert.isUndefined(resolved.cooldownHours);
      assert.strictEqual(resolved.skipFirstLaunch, false);
      assert.isUndefined(resolved.userId);
    });
  });

  describe("getFrequencyStorageNamespace", () => {
    it("uses anon when userId is omitted", () => {
      assert.strictEqual(getFrequencyStorageNamespace(), "anon");
      assert.strictEqual(getFrequencyStorageNamespace(undefined), "anon");
    });

    it("uses the provided userId for namespacing", () => {
      assert.strictEqual(getFrequencyStorageNamespace("user-123"), "user-123");
    });
  });

  describe("shouldSuppressInterrupt", () => {
    it("suppresses when the session cap is reached", async () => {
      const deps = createDeps();
      const config = {maxInterruptionsPerSession: 1};

      await recordInterruptShown(config, "announcement-1:1", deps);
      const suppress = await shouldSuppressInterrupt(config, "announcement-2:1", deps);

      assert.strictEqual(suppress, true);
    });

    it("allows another interrupt when maxInterruptionsPerSession is higher", async () => {
      const deps = createDeps();
      const config = {maxInterruptionsPerSession: 2};

      await recordInterruptShown(config, "announcement-1:1", deps);
      const suppress = await shouldSuppressInterrupt(config, "announcement-2:1", deps);

      assert.strictEqual(suppress, false);
    });

    it("skips interrupts on first launch when skipFirstLaunch is true", async () => {
      const deps = createDeps();
      const config = {skipFirstLaunch: true, userId: "user-a"};

      const suppress = await shouldSuppressInterrupt(config, "announcement-1:1", deps);

      assert.strictEqual(suppress, true);
      const hasLaunchedKey = buildFrequencyStorageKey("user-a", "hasLaunched");
      assert.strictEqual(await deps.storage?.getItem(hasLaunchedKey), "true");
    });

    it("shows interrupts on subsequent launches after skipFirstLaunch stored hasLaunched", async () => {
      const deps = createDeps({
        storage: createMemoryStorage({
          [buildFrequencyStorageKey("user-a", "hasLaunched")]: "true",
        }),
      });
      const config = {skipFirstLaunch: true, userId: "user-a"};

      const suppress = await shouldSuppressInterrupt(config, "announcement-1:1", deps);

      assert.strictEqual(suppress, false);
    });

    it("keeps skipping for the rest of the session after first-launch skip", async () => {
      const deps = createDeps();
      const config = {skipFirstLaunch: true};

      const firstCheck = await shouldSuppressInterrupt(config, "announcement-1:1", deps);
      const secondCheck = await shouldSuppressInterrupt(config, "announcement-2:1", deps);

      assert.strictEqual(firstCheck, true);
      assert.strictEqual(secondCheck, true);
    });

    it("suppresses when last interrupt is inside the cooldown window", async () => {
      const deps = createDeps({
        storage: createMemoryStorage({
          [buildFrequencyStorageKey("anon", "lastInterruptAt")]: "2026-09-15T10:00:00.000Z",
        }),
      });
      const config = {cooldownHours: 24};

      const suppress = await shouldSuppressInterrupt(config, "announcement-1:1", deps);

      assert.strictEqual(suppress, true);
    });

    it("allows interrupts after the cooldown window elapses", async () => {
      const deps = createDeps({
        storage: createMemoryStorage({
          [buildFrequencyStorageKey("anon", "lastInterruptAt")]: "2026-09-14T11:00:00.000Z",
        }),
      });
      const config = {cooldownHours: 24};

      const suppress = await shouldSuppressInterrupt(config, "announcement-1:1", deps);

      assert.strictEqual(suppress, false);
    });

    it("fails open when storage reads fail", async () => {
      const warnings: Array<{message: string; details?: unknown}> = [];
      const deps = createDeps({
        storage: {
          getItem: async (): Promise<string | null> => {
            throw new Error("storage read failed");
          },
          setItem: async (): Promise<void> => {
            throw new Error("storage write failed");
          },
        },
        warn: (message: string, details?: unknown): void => {
          warnings.push({details, message});
        },
      });
      const config = {cooldownHours: 24, skipFirstLaunch: true};

      const suppress = await shouldSuppressInterrupt(config, "announcement-1:1", deps);

      assert.strictEqual(suppress, false);
      assert.isAtLeast(warnings.length, 1);
    });
  });

  describe("recordInterruptShown", () => {
    it("increments the session counter exactly once per announcement id:version", async () => {
      const deps = createDeps();
      const config = {maxInterruptionsPerSession: 2};

      await recordInterruptShown(config, "announcement-1:1", deps);
      await recordInterruptShown(config, "announcement-1:1", deps);

      assert.strictEqual(deps.session?.getInterruptionCount(), 1);
    });

    it("persists lastInterruptAt when an interrupt becomes visible", async () => {
      const deps = createDeps();
      const config = {userId: "user-b"};

      await recordInterruptShown(config, "announcement-1:2", deps);

      const lastKey = buildFrequencyStorageKey("user-b", "lastInterruptAt");
      assert.strictEqual(await deps.storage?.getItem(lastKey), "2026-09-15T12:00:00.000Z");
    });

    it("warns but does not throw when storage writes fail", async () => {
      const warnings: Array<{message: string; details?: unknown}> = [];
      const deps = createDeps({
        storage: {
          getItem: async (): Promise<string | null> => null,
          setItem: async (): Promise<void> => {
            throw new Error("storage write failed");
          },
        },
        warn: (message: string, details?: unknown): void => {
          warnings.push({details, message});
        },
      });

      await recordInterruptShown({}, "announcement-1:1", deps);

      assert.strictEqual(deps.session?.getInterruptionCount(), 1);
      assert.isTrue(warnings.some((entry) => entry.message.includes("lastInterruptAt")));
    });
  });
});
