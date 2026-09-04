import type {AdminCustomScreen, AdminModelConfig} from "./types";

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

export interface AdminScreenNavGroup {
  group: string;
  screens: AdminCustomScreen[];
}

export interface GroupedAdminCustomScreens {
  grouped: AdminScreenNavGroup[];
  ungrouped: AdminCustomScreen[];
}

const screenGroupSlug = (group: string): string => {
  return group.trim().toLowerCase().replace(/\s+/g, "-");
};

/**
 * Groups custom screens by {@link AdminCustomScreen.group}.
 * Screens without a group stay under the ungrouped "Screens" heading.
 */
export const groupAdminCustomScreens = (
  screens: AdminCustomScreen[]
): GroupedAdminCustomScreens => {
  const groupedMap = new Map<string, AdminCustomScreen[]>();
  const ungrouped: AdminCustomScreen[] = [];
  for (const screen of screens) {
    const group = screen.group?.trim();
    if (!group) {
      ungrouped.push(screen);
      continue;
    }
    const list = groupedMap.get(group);
    if (list) {
      list.push(screen);
    } else {
      groupedMap.set(group, [screen]);
    }
  }
  const grouped = [...groupedMap.keys()]
    .sort((a, b) => {
      return a.localeCompare(b);
    })
    .map((group) => ({
      group,
      screens: groupedMap.get(group) ?? [],
    }));
  return {grouped, ungrouped};
};

export const adminScreenGroupTestId = (group: string): string => {
  return `admin-shell-nav-group-${screenGroupSlug(group)}`;
};
