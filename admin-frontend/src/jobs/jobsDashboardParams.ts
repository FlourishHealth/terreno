export interface JobsDashboardFilters {
  end?: string;
  name?: string;
  page?: number;
  q?: string;
  scheduleId?: string;
  start?: string;
  status?: string;
}

const asString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return asString(value[0]);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseJobsDashboardSearchParams = (
  params: Record<string, unknown>
): JobsDashboardFilters => {
  const pageValue = asString(params.page);
  const page = pageValue ? Number.parseInt(pageValue, 10) : undefined;
  const filters: JobsDashboardFilters = {};
  const end = asString(params.end);
  if (end) {
    filters.end = end;
  }
  const name = asString(params.name);
  if (name) {
    filters.name = name;
  }
  if (page && page > 0) {
    filters.page = page;
  }
  const q = asString(params.q);
  if (q) {
    filters.q = q;
  }
  const scheduleId = asString(params.scheduleId);
  if (scheduleId) {
    filters.scheduleId = scheduleId;
  }
  const start = asString(params.start);
  if (start) {
    filters.start = start;
  }
  const status = asString(params.status);
  if (status) {
    filters.status = status;
  }
  return filters;
};

export const serializeJobsDashboardSearchParams = (
  filters: JobsDashboardFilters
): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filters.name) {
    params.name = filters.name;
  }
  if (filters.status) {
    params.status = filters.status;
  }
  if (filters.scheduleId) {
    params.scheduleId = filters.scheduleId;
  }
  if (filters.q?.trim()) {
    params.q = filters.q.trim();
  }
  if (filters.start) {
    params.start = filters.start;
  }
  if (filters.end) {
    params.end = filters.end;
  }
  if (filters.page && filters.page > 1) {
    params.page = String(filters.page);
  }
  return params;
};
