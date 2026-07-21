/**
 * RTK Query APIs after dynamic `injectEndpoints` expose hooks as string-keyed properties.
 * This record type avoids `any` while keeping hook lookup ergonomic.
 */
export type DynamicHookApi = Record<string, unknown>;

export const asDynamicHookApi = (api: unknown): DynamicHookApi => {
  return api as DynamicHookApi;
};
