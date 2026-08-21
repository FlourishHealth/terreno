import type {AdminModelSource} from "./resolvedAdminModel";

export interface AdminConfigNameInput {
  modelName: string;
  routePath: string;
  source?: AdminModelSource;
}

const SOURCE_RANK: Record<AdminModelSource, number> = {
  legacy: 0,
  plugin: 1,
  registered: 2,
};

export const slugFromAdminRoutePath = (routePath: string): string => {
  const trimmed = routePath.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
  if (!trimmed) {
    return "model";
  }
  return trimmed;
};

const sourceRank = (source?: AdminModelSource): number => {
  if (!source) {
    return 0;
  }
  return SOURCE_RANK[source];
};

/**
 * UI route keys must be unique even when the same Mongoose model is mounted at
 * two `routePath`s. Keep `modelName` for a singleton (and for the highest-precedence
 * duplicate). Suffix the rest with the route slug.
 */
export const assignUniqueAdminConfigNames = (entries: AdminConfigNameInput[]): string[] => {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.modelName, (counts.get(entry.modelName) ?? 0) + 1);
  }

  const preferredIndex = new Map<string, number>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || (counts.get(entry.modelName) ?? 0) <= 1) {
      continue;
    }
    const existing = preferredIndex.get(entry.modelName);
    if (existing === undefined) {
      preferredIndex.set(entry.modelName, index);
      continue;
    }
    const current = entries[existing];
    if (!current) {
      preferredIndex.set(entry.modelName, index);
      continue;
    }
    if (sourceRank(entry.source) > sourceRank(current.source)) {
      preferredIndex.set(entry.modelName, index);
    }
  }

  const used = new Set<string>();
  return entries.map((entry, index) => {
    const isDuplicate = (counts.get(entry.modelName) ?? 0) > 1;
    const keepBare = !isDuplicate || preferredIndex.get(entry.modelName) === index;
    let candidate = keepBare
      ? entry.modelName
      : `${entry.modelName}-${slugFromAdminRoutePath(entry.routePath)}`;
    if (used.has(candidate)) {
      const base = candidate;
      let suffix = 2;
      while (used.has(`${base}-${suffix}`)) {
        suffix += 1;
      }
      candidate = `${base}-${suffix}`;
    }
    used.add(candidate);
    return candidate;
  });
};

export const findAdminModelMetaByRoutePath = <T extends {routePath: string}>(
  models: T[],
  mountedRoutePath: string
): T | undefined => {
  return models.find((model) => model.routePath === mountedRoutePath);
};
