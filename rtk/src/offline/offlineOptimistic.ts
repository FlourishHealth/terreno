import type {Api} from "@reduxjs/toolkit/query/react";

import type {OfflineOptimisticUpdateContext, QueuedMutation} from "./offlineTypes";

export const buildOptimisticCreateItem = (
  mutation: QueuedMutation,
  body?: Record<string, unknown>,
  optimisticId?: string
): Record<string, unknown> => {
  const localId = optimisticId ?? mutation.optimisticId ?? `temp-${mutation.id}`;
  return {
    ...(body ?? {}),
    _id: localId,
    created: mutation.createdAt,
    id: localId,
    updated: mutation.createdAt,
  };
};

export const inferListEndpointName = (tagType: string): string => {
  return `get${tagType.charAt(0).toUpperCase() + tagType.slice(1)}`;
};

export const inferGetByIdEndpointName = (tagType: string): string => {
  return `get${tagType.charAt(0).toUpperCase() + tagType.slice(1)}ById`;
};

export const getCachedQueryArgs = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic API state shape
  getState: () => any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>,
  listEndpointName: string
): unknown[] => {
  const state = getState();
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query internal state shape
  const queries: Record<string, any> = state[api.reducerPath]?.queries ?? {};
  const cachedArgs: unknown[] = [];
  for (const key of Object.keys(queries)) {
    if (key.startsWith(`${listEndpointName}(`)) {
      cachedArgs.push(queries[key]?.originalArgs);
    }
  }
  if (cachedArgs.length === 0) {
    cachedArgs.push(undefined);
  }
  return cachedArgs;
};

export const applyDefaultOptimisticUpdate = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch: any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState: () => any,
  mutation: QueuedMutation,
  tagType: string
): void => {
  const listEndpointName = inferListEndpointName(tagType);
  const cachedArgs = getCachedQueryArgs(getState, api, listEndpointName);

  // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
  const updateAllCacheEntries = (updater: (draft: any) => void): void => {
    for (const queryArg of cachedArgs) {
      dispatch(
        // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
        api.util.updateQueryData(listEndpointName as any, queryArg, updater)
      );
    }
  };

  if (mutation.operation === "create") {
    const args = mutation.args as {body?: Record<string, unknown>};
    const tempItem = buildOptimisticCreateItem(mutation, args?.body ?? mutation.body);
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
    updateAllCacheEntries((draft: any) => {
      if (draft?.data && Array.isArray(draft.data)) {
        draft.data.unshift(tempItem);
      }
    });
    return;
  }

  if (mutation.operation === "update" || mutation.operation === "arrayUpdate") {
    const args = mutation.args as {id?: string; body?: Record<string, unknown>};
    const patchBody = args?.body ?? mutation.body;
    if (args?.id && patchBody) {
      // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
      updateAllCacheEntries((draft: any) => {
        if (draft?.data && Array.isArray(draft.data)) {
          const item = draft.data.find(
            (d: Record<string, unknown>) => d._id === args.id || d.id === args.id
          );
          if (item) {
            Object.assign(item, patchBody);
          }
        }
      });
    }
    return;
  }

  if (mutation.operation === "delete" || mutation.operation === "arrayRemove") {
    const args = mutation.args as {id?: string};
    if (args?.id) {
      // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
      updateAllCacheEntries((draft: any) => {
        if (draft?.data && Array.isArray(draft.data)) {
          draft.data = draft.data.filter(
            (d: Record<string, unknown>) => d._id !== args.id && d.id !== args.id
          );
        }
      });
    }
  }
};

export const applyOptimisticUpdate = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch: any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState: () => any,
  mutation: QueuedMutation,
  tagType: string,
  customOptimisticUpdate?: import("./offlineTypes").OfflineOptimisticUpdate
): void => {
  const context: OfflineOptimisticUpdateContext = {
    listEndpointName: inferListEndpointName(tagType),
    mutation,
    tagType,
  };

  if (customOptimisticUpdate?.apply) {
    customOptimisticUpdate.apply(context);
    return;
  }

  applyDefaultOptimisticUpdate(api, dispatch, getState, mutation, tagType);
};

export const removeOptimisticTempItems = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch: any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState: () => any,
  mutations: QueuedMutation[],
  tagTypes: string[]
): void => {
  const tempIds = new Set(
    mutations.flatMap((m) => {
      const ids: string[] = [`temp-${m.id}`];
      if (m.optimisticId) {
        ids.push(m.optimisticId);
      }
      return ids;
    })
  );

  for (const tagType of tagTypes) {
    const listEndpointName = inferListEndpointName(tagType);
    const cachedArgs = getCachedQueryArgs(getState, api, listEndpointName);

    for (const queryArg of cachedArgs) {
      dispatch(
        // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
        api.util.updateQueryData(listEndpointName as any, queryArg, (draft: any) => {
          if (draft?.data && Array.isArray(draft.data)) {
            draft.data = draft.data.filter(
              (d: Record<string, unknown>) =>
                !tempIds.has(d._id as string) && !tempIds.has(d.id as string)
            );
          }
        })
      );
    }
  }
};

export const patchCacheWithServerDocument = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch: any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState: () => any,
  tagType: string,
  document: Record<string, unknown>
): void => {
  const docId = (document._id ?? document.id) as string | undefined;
  if (!docId) {
    return;
  }

  const listEndpointName = inferListEndpointName(tagType);
  const cachedArgs = getCachedQueryArgs(getState, api, listEndpointName);

  for (const queryArg of cachedArgs) {
    dispatch(
      // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
      api.util.updateQueryData(listEndpointName as any, queryArg, (draft: any) => {
        if (draft?.data && Array.isArray(draft.data)) {
          const index = draft.data.findIndex(
            (d: Record<string, unknown>) => d._id === docId || d.id === docId
          );
          if (index >= 0) {
            draft.data[index] = {...draft.data[index], ...document};
          }
        }
      })
    );
  }
};
