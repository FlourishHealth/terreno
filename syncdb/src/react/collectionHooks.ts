import {useCallback, useMemo} from "react";

import type {UseEntityResult, UseQueryOptions} from "./hooks";
import {useEntity, useMutate, useQuery} from "./hooks";

export interface CollectionHooksConfig {
  collection: string;
  /** false → 1 attempt (fail fast); number → max replay attempts; omitted → engine default (5). */
  retries?: boolean | number;
}

export type MutationTrigger<TArgs> = (args: TArgs) => {mutationId: string; id: string};

export interface CollectionHooks<TData, TCreate, TUpdate> {
  useListQuery: (options?: UseQueryOptions<TData>) => {data: TData[]};
  useReadQuery: (id: string) => UseEntityResult<TData>;
  useCreateMutation: () => [MutationTrigger<{data: TCreate}>];
  useUpdateMutation: () => [MutationTrigger<{id: string; data: TUpdate}>];
  useDeleteMutation: () => [MutationTrigger<{id: string}>];
}

const resolveMaxAttempts = (retries: boolean | number | undefined): number | undefined => {
  if (retries === false) {
    return 1;
  }
  if (typeof retries === "number") {
    return retries;
  }
  return undefined;
};

export const createCollectionHooks = <
  TData = Record<string, unknown>,
  TCreate = Record<string, unknown>,
  TUpdate = Partial<TCreate>,
>(
  config: CollectionHooksConfig
): CollectionHooks<TData, TCreate, TUpdate> => {
  const maxAttempts = resolveMaxAttempts(config.retries);

  const useListQuery = (options?: UseQueryOptions<TData>): {data: TData[]} => {
    const data = useQuery<TData>(config.collection, options);
    return {data};
  };

  const useReadQuery = (id: string): UseEntityResult<TData> => useEntity<TData>(config.collection, id);

  const useCreateMutation = (): [MutationTrigger<{data: TCreate}>] => {
    const {create} = useMutate(config.collection);
    const trigger = useCallback(
      (args: {data: TCreate}): {mutationId: string; id: string} =>
        create({
          data: args.data as unknown as Record<string, unknown>,
          ...(maxAttempts !== undefined ? {maxAttempts} : {}),
        }),
      [create, maxAttempts]
    );
    return useMemo(() => [trigger], [trigger]);
  };

  const useUpdateMutation = (): [MutationTrigger<{id: string; data: TUpdate}>] => {
    const {update} = useMutate(config.collection);
    const trigger = useCallback(
      (args: {id: string; data: TUpdate}): {mutationId: string; id: string} =>
        update({
          data: args.data as unknown as Record<string, unknown>,
          id: args.id,
          ...(maxAttempts !== undefined ? {maxAttempts} : {}),
        }),
      [maxAttempts, update]
    );
    return useMemo(() => [trigger], [trigger]);
  };

  const useDeleteMutation = (): [MutationTrigger<{id: string}>] => {
    const {remove} = useMutate(config.collection);
    const trigger = useCallback(
      (args: {id: string}): {mutationId: string; id: string} =>
        remove({
          id: args.id,
          ...(maxAttempts !== undefined ? {maxAttempts} : {}),
        }),
      [maxAttempts, remove]
    );
    return useMemo(() => [trigger], [trigger]);
  };

  return {
    useCreateMutation,
    useDeleteMutation,
    useListQuery,
    useReadQuery,
    useUpdateMutation,
  };
};
