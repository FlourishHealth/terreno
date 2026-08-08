import type {AdminModelConfig} from "./types";

export interface AdminModelGroup {
  group: string;
  models: AdminModelConfig[];
}

/**
 * Groups admin models by {@link AdminModelConfig.group} for sidebar navigation.
 * Models without a group go under "General", which is sorted last.
 */
export const groupAdminModelsByGroup = (models: AdminModelConfig[]): AdminModelGroup[] => {
  const map = new Map<string, AdminModelConfig[]>();
  for (const model of models) {
    const group = model.group?.trim() || "General";
    const list = map.get(group);
    if (list) {
      list.push(model);
    } else {
      map.set(group, [model]);
    }
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === "General") {
      return 1;
    }
    if (b === "General") {
      return -1;
    }
    return a.localeCompare(b);
  });
  return keys.map((group) => ({group, models: map.get(group) ?? []}));
};
