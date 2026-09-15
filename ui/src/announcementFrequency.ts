import {DateTime} from "luxon";

import {Unifier} from "./Unifier";

export interface AnnouncementFrequencyConfig {
  cooldownHours?: number;
  maxInterruptionsPerSession?: number;
  skipFirstLaunch?: boolean;
  userId?: string;
}

export interface ResolvedAnnouncementFrequencyConfig {
  cooldownHours?: number;
  maxInterruptionsPerSession: number;
  skipFirstLaunch: boolean;
  userId?: string;
}

export interface FrequencyStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export interface FrequencyClock {
  now: () => DateTime;
}

export interface FrequencySessionState {
  getInterruptionCount: () => number;
  hasRecordedInterruptKey: (key: string) => boolean;
  incrementInterruptionCount: () => void;
  isFirstLaunchSkipActive: () => boolean;
  markRecordedInterruptKey: (key: string) => void;
  setFirstLaunchSkipActive: (active: boolean) => void;
}

export interface AnnouncementFrequencyDeps {
  clock?: FrequencyClock;
  session?: FrequencySessionState;
  storage?: FrequencyStorage;
  warn?: (message: string, details?: unknown) => void;
}

const STORAGE_KEY_PREFIX = "terreno:announcements:frequency";

export const getFrequencyStorageNamespace = (userId?: string): string => {
  return userId ?? "anon";
};

export const buildFrequencyStorageKey = (
  namespace: string,
  suffix: "hasLaunched" | "lastInterruptAt"
): string => {
  return `${STORAGE_KEY_PREFIX}:${namespace}:${suffix}`;
};

export const resolveFrequencyConfig = (
  config?: AnnouncementFrequencyConfig
): ResolvedAnnouncementFrequencyConfig => ({
  cooldownHours: config?.cooldownHours,
  maxInterruptionsPerSession: config?.maxInterruptionsPerSession ?? 1,
  skipFirstLaunch: config?.skipFirstLaunch ?? false,
  userId: config?.userId,
});

export const createFrequencySessionState = (): FrequencySessionState => {
  let interruptionCount = 0;
  let firstLaunchSkipActive = false;
  const recordedInterruptKeys = new Set<string>();

  return {
    getInterruptionCount: (): number => interruptionCount,
    hasRecordedInterruptKey: (key: string): boolean => recordedInterruptKeys.has(key),
    incrementInterruptionCount: (): void => {
      interruptionCount += 1;
    },
    isFirstLaunchSkipActive: (): boolean => firstLaunchSkipActive,
    markRecordedInterruptKey: (key: string): void => {
      recordedInterruptKeys.add(key);
    },
    setFirstLaunchSkipActive: (active: boolean): void => {
      firstLaunchSkipActive = active;
    },
  };
};

let moduleSessionState: FrequencySessionState | undefined;

export const getFrequencySessionState = (
  override?: FrequencySessionState
): FrequencySessionState => {
  if (override) {
    return override;
  }
  if (!moduleSessionState) {
    moduleSessionState = createFrequencySessionState();
  }
  return moduleSessionState;
};

export const resetFrequencySessionStateForTests = (): void => {
  moduleSessionState = undefined;
};

const defaultWarn = (message: string, details?: unknown): void => {
  console.warn(message, details);
};

const defaultClock = (): FrequencyClock => ({
  now: (): DateTime => DateTime.now(),
});

const createAsyncStorageAdapter = (): FrequencyStorage => ({
  getItem: async (key: string): Promise<string | null> => {
    const value = await Unifier.storage.getItem(key);
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === "string" ? value : String(value);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Unifier.storage.setItem(key, value);
  },
});

const readHasLaunched = async (
  storage: FrequencyStorage,
  namespace: string,
  warn: (message: string, details?: unknown) => void
): Promise<boolean | null> => {
  const key = buildFrequencyStorageKey(namespace, "hasLaunched");
  try {
    const value = await storage.getItem(key);
    return value !== null;
  } catch (error) {
    warn("[announcementFrequency] Failed to read hasLaunched; allowing interrupt", {error});
    return null;
  }
};

const writeHasLaunched = async (
  storage: FrequencyStorage,
  namespace: string,
  warn: (message: string, details?: unknown) => void
): Promise<boolean> => {
  const key = buildFrequencyStorageKey(namespace, "hasLaunched");
  try {
    await storage.setItem(key, "true");
    return true;
  } catch (error) {
    warn("[announcementFrequency] Failed to persist hasLaunched", {error});
    return false;
  }
};

const isInsideCooldown = (
  lastInterruptAt: string,
  cooldownHours: number,
  clock: FrequencyClock
): boolean => {
  const lastShown = DateTime.fromISO(lastInterruptAt);
  if (!lastShown.isValid) {
    return false;
  }
  const hoursSince = clock.now().diff(lastShown, "hours").hours;
  return hoursSince < cooldownHours;
};

export const shouldSuppressInterrupt = async (
  config: AnnouncementFrequencyConfig | undefined,
  _announcementKey: string,
  deps?: AnnouncementFrequencyDeps
): Promise<boolean> => {
  const resolved = resolveFrequencyConfig(config);
  const session = getFrequencySessionState(deps?.session);
  const warn = deps?.warn ?? defaultWarn;
  const storage = deps?.storage ?? createAsyncStorageAdapter();
  const clock = deps?.clock ?? defaultClock();
  const namespace = getFrequencyStorageNamespace(resolved.userId);

  if (session.getInterruptionCount() >= resolved.maxInterruptionsPerSession) {
    return true;
  }

  if (resolved.skipFirstLaunch) {
    if (session.isFirstLaunchSkipActive()) {
      return true;
    }

    const hasLaunched = await readHasLaunched(storage, namespace, warn);
    if (hasLaunched === false) {
      const persisted = await writeHasLaunched(storage, namespace, warn);
      if (persisted) {
        session.setFirstLaunchSkipActive(true);
        return true;
      }
    }
  }

  if (resolved.cooldownHours !== undefined && resolved.cooldownHours > 0) {
    const lastKey = buildFrequencyStorageKey(namespace, "lastInterruptAt");
    try {
      const lastInterruptAt = await storage.getItem(lastKey);
      if (lastInterruptAt && isInsideCooldown(lastInterruptAt, resolved.cooldownHours, clock)) {
        return true;
      }
    } catch (error) {
      warn("[announcementFrequency] Failed to read lastInterruptAt; allowing interrupt", {error});
    }
  }

  return false;
};

export const recordInterruptShown = async (
  config: AnnouncementFrequencyConfig | undefined,
  announcementKey: string,
  deps?: AnnouncementFrequencyDeps
): Promise<void> => {
  const resolved = resolveFrequencyConfig(config);
  const session = getFrequencySessionState(deps?.session);
  const warn = deps?.warn ?? defaultWarn;
  const storage = deps?.storage ?? createAsyncStorageAdapter();
  const clock = deps?.clock ?? defaultClock();
  const namespace = getFrequencyStorageNamespace(resolved.userId);

  if (session.hasRecordedInterruptKey(announcementKey)) {
    return;
  }

  session.markRecordedInterruptKey(announcementKey);
  session.incrementInterruptionCount();

  const iso = clock.now().toISO();
  if (!iso) {
    warn("[announcementFrequency] Failed to serialize interrupt timestamp");
    return;
  }

  const lastKey = buildFrequencyStorageKey(namespace, "lastInterruptAt");
  try {
    await storage.setItem(lastKey, iso);
  } catch (error) {
    warn("[announcementFrequency] Failed to persist lastInterruptAt", {error});
  }
};
