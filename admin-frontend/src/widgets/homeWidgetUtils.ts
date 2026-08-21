export const BUILTIN_HOME_WIDGET_IDS = new Set([
  "modelStats",
  "modelsGrid",
  "feature-flags-overrides",
  "versionConfig",
  "scriptRunner",
  "recentActivity",
]);

export const normalizeWidgetIds = (ids: string[] | undefined): string[] => {
  if (!ids?.length) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const normalized = id === "modelStats" ? "modelsGrid" : id;
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

export const normalizeSidebarWidgets = (ids: string[] | undefined): string[] => {
  const normalized = normalizeWidgetIds(ids);
  if (!normalized.length) {
    return normalized;
  }
  const tail = "recentActivity";
  const without = normalized.filter((id) => id !== tail);
  if (normalized.includes(tail)) {
    return [...without, tail];
  }
  return normalized;
};
