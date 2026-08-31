/**
 * RTK Query APIs after dynamic `injectEndpoints` expose hooks as string-keyed properties.
 * Hook names are generated at runtime from endpoint keys and are not statically expressible.
 */
// noExplicitAny: injectEndpoints adds hook properties at runtime; Record<string, unknown> makes every hook `unknown` and breaks all admin call sites that invoke them without casts
// biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
export type DynamicHookApi = Record<string, any>;

export const asDynamicHookApi = (api: unknown): DynamicHookApi => {
  return api as DynamicHookApi;
};
