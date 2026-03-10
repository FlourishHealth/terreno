import {useCallback, useEffect, useState} from "react";
import type {PaginatedResult, PromptListItem} from "../../backend/types";
import {useLangfuseContext} from "../LangfuseProvider";

interface UsePromptsResult {
  prompts: PromptListItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  refetch: () => void;
}

export const usePrompts = (limit = 20): UsePromptsResult => {
  const {apiBaseUrl} = useLangfuseContext();
  const [prompts, setPrompts] = useState<PromptListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [fetchKey, setFetchKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchKey is a manual refresh trigger
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`${apiBaseUrl}/prompts?page=${page}&limit=${limit}`, {credentials: "include"})
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch prompts: ${res.status}`);
        }
        return res.json() as Promise<PaginatedResult<PromptListItem>>;
      })
      .then((data) => {
        if (!cancelled) {
          setPrompts(data.data);
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
  }, [apiBaseUrl, page, limit, fetchKey]);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  return {error, isLoading, page, prompts, refetch, setPage, total};
};
