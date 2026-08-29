export interface CommsDashboardFilters {
  channel?: string;
  endDate?: string;
  errorClass?: string;
  page?: number;
  provider?: string;
  q?: string;
  startDate?: string;
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

export const parseCommsDashboardSearchParams = (
  params: Record<string, unknown>
): CommsDashboardFilters => {
  const pageValue = asString(params.page);
  const page = pageValue ? Number.parseInt(pageValue, 10) : undefined;
  return {
    channel: asString(params.channel),
    endDate: asString(params.endDate),
    errorClass: asString(params.errorClass),
    page: page && page > 0 ? page : undefined,
    provider: asString(params.provider),
    q: asString(params.q),
    startDate: asString(params.startDate),
    status: asString(params.status),
  };
};

export const serializeCommsDashboardSearchParams = (
  filters: CommsDashboardFilters
): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filters.channel) {
    params.channel = filters.channel;
  }
  if (filters.provider) {
    params.provider = filters.provider;
  }
  if (filters.status) {
    params.status = filters.status;
  }
  if (filters.errorClass) {
    params.errorClass = filters.errorClass;
  }
  if (filters.q?.trim()) {
    params.q = filters.q.trim();
  }
  if (filters.startDate) {
    params.startDate = filters.startDate;
  }
  if (filters.endDate) {
    params.endDate = filters.endDate;
  }
  if (filters.page && filters.page > 1) {
    params.page = String(filters.page);
  }
  return params;
};
