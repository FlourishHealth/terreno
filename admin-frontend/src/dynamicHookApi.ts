/**
 * RTK Query APIs after dynamic `injectEndpoints` expose hooks as string-keyed properties.
 * Hook names are generated at runtime from endpoint keys and are not statically expressible.
 */
// noExplicitAny: RTK Query generates hook names dynamically from injectEndpoints keys
// biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
export type DynamicHookApi = Record<string, any>;

export const asDynamicHookApi = (api: unknown): DynamicHookApi => {
  return api as DynamicHookApi;
};
