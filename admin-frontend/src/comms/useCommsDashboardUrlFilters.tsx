import type {Href} from "expo-router";
import {router, useLocalSearchParams} from "expo-router";
import {useCallback, useMemo} from "react";
import {
  type CommsDashboardFilters,
  parseCommsDashboardSearchParams,
  serializeCommsDashboardSearchParams,
} from "./commsDashboardParams";

export const useCommsDashboardUrlFilters = (
  routeBase?: string
): {
  filters: CommsDashboardFilters;
  onFiltersChange: (next: CommsDashboardFilters) => void;
} => {
  const params = useLocalSearchParams();
  const filters = useMemo(() => parseCommsDashboardSearchParams(params), [params]);
  const base = routeBase ?? "";

  const onFiltersChange = useCallback(
    (next: CommsDashboardFilters): void => {
      const serialized = serializeCommsDashboardSearchParams(next);
      const query = new URLSearchParams(serialized).toString();
      const path = `${base}/comms`;
      router.replace((query ? `${path}?${query}` : path) as Href);
    },
    [base]
  );

  return {filters, onFiltersChange};
};
