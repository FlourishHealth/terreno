import {useCallback, useEffect, useState} from "react";
import {useAdminContext} from "./AdminProvider";
import type {AdminRequestArgs} from "./adminRequest";
import type {AdminRpc} from "./adminRpc";

export const useAdminRpc = (): AdminRpc | undefined => {
  const ctx = useAdminContext();
  return ctx?.adminRpc;
};

export interface AdminRpcQueryState<T> {
  data: T | undefined;
  error: unknown;
  isFetching: boolean;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * GET-style admin RPC. Skips when `rpc` is missing or `skip` is true so RTK
 * dual-run callers can keep a stable hook order.
 */
export const useAdminRpcQuery = <T = unknown>({
  pollingInterval,
  rpc,
  skip = false,
  url,
}: {
  pollingInterval?: number;
  rpc?: AdminRpc;
  skip?: boolean;
  url: string;
}): AdminRpcQueryState<T> => {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(Boolean(rpc) && !skip);
  const [generation, setGeneration] = useState(0);

  const refetch = useCallback((): void => {
    setGeneration((current) => current + 1);
  }, []);

  // Fetch whenever the bound client, URL, or skip flag changes.
  useEffect(() => {
    if (!rpc || skip) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    rpc({method: "GET", url})
      .then((result) => {
        if (!cancelled) {
          setData(result as T);
          setIsLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [generation, rpc, skip, url]);

  // Re-run the request on the same interval RTK `pollingInterval` uses.
  useEffect(() => {
    if (!rpc || skip || !pollingInterval) {
      return;
    }
    const timer = setInterval(() => {
      setGeneration((current) => current + 1);
    }, pollingInterval);
    return () => {
      clearInterval(timer);
    };
  }, [pollingInterval, rpc, skip]);

  return {data, error, isFetching: isLoading, isLoading, refetch};
};

export const useAdminRpcMutation = (
  rpc: AdminRpc | undefined
): [(args: AdminRequestArgs) => {unwrap: () => Promise<unknown>}, {isLoading: boolean}] => {
  const [isLoading, setIsLoading] = useState(false);
  const trigger = useCallback(
    (args: AdminRequestArgs): {unwrap: () => Promise<unknown>} => {
      return {
        unwrap: async (): Promise<unknown> => {
          if (!rpc) {
            throw new Error("Admin RPC client is unavailable");
          }
          setIsLoading(true);
          try {
            return await rpc(args);
          } finally {
            setIsLoading(false);
          }
        },
      };
    },
    [rpc]
  );
  return [trigger, {isLoading}] as [
    (args: AdminRequestArgs) => {unwrap: () => Promise<unknown>},
    {isLoading: boolean},
  ];
};
