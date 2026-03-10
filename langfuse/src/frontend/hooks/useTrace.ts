import {useCallback, useEffect, useState} from "react";
import type {PaginatedResult, TraceListItem} from "../../backend/types";
import {useLangfuseContext} from "../LangfuseProvider";

interface UseTracesResult {
  traces: TraceListItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  refetch: () => void;
}

interface UseTraceResult {
  trace: TraceListItem | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useTraces = (params?: {
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): UseTracesResult => {
  const {apiBaseUrl} = useLangfuseContext();
  const [traces, setTraces] = useState<TraceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [fetchKey, setFetchKey] = useState(0);
  const limit = params?.limit ?? 20;

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchKey is a manual refresh trigger
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const query = new URLSearchParams({limit: String(limit), page: String(page)});
    if (params?.userId) {
      query.set("userId", params.userId);
    }
    if (params?.from) {
      query.set("from", params.from);
    }
    if (params?.to) {
      query.set("to", params.to);
    }

    fetch(`${apiBaseUrl}/traces?${query.toString()}`, {credentials: "include"})
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch traces: ${res.status}`);
        }
        return res.json() as Promise<PaginatedResult<TraceListItem>>;
      })
      .then((data) => {
        if (!cancelled) {
          setTraces(data.data);
          setTotal(data.meta.total);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, page, limit, params?.userId, params?.from, params?.to, fetchKey]);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  return {error, isLoading, page, refetch, setPage, total, traces};
};

export const useTrace = (traceId: string): UseTraceResult => {
  const {apiBaseUrl} = useLangfuseContext();
  const [trace, setTrace] = useState<TraceListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchKey is a manual refresh trigger
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`${apiBaseUrl}/traces/${encodeURIComponent(traceId)}`, {credentials: "include"})
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch trace: ${res.status}`);
        }
        return res.json() as Promise<TraceListItem>;
      })
      .then((data) => {
        if (!cancelled) {
          setTrace(data);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, traceId, fetchKey]);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  return {error, isLoading, refetch, trace};
};
