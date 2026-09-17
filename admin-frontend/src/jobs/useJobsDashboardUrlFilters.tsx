import type {Href} from "expo-router";
import {router, useLocalSearchParams} from "expo-router";
import {useCallback, useMemo} from "react";
import {
  type JobsDashboardFilters,
  parseJobsDashboardSearchParams,
  serializeJobsDashboardSearchParams,
} from "./jobsDashboardParams";

export const useJobsDashboardUrlFilters = (
  routeBase?: string
): {
  filters: JobsDashboardFilters;
  onFiltersChange: (next: JobsDashboardFilters) => void;
} => {
  const params = useLocalSearchParams();
  const filters = useMemo(() => parseJobsDashboardSearchParams(params), [params]);
  const base = routeBase ?? "";

  const onFiltersChange = useCallback(
    (next: JobsDashboardFilters): void => {
      const serialized = serializeJobsDashboardSearchParams(next);
      const query = new URLSearchParams(serialized).toString();
      const path = `${base}/jobs`;
      router.replace((query ? `${path}?${query}` : path) as Href);
    },
    [base]
  );

  return {filters, onFiltersChange};
};
