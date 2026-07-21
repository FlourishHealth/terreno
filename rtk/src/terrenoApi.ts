import type {Api, BaseQueryFn, EndpointDefinitions} from "@reduxjs/toolkit/query/react";

/**
 * Type-erased RTK Query API instance used across Terreno packages.
 *
 * Consumer apps generate distinct endpoint sets from OpenAPI; this alias captures the
 * shared base-query and tag-type shape without fixing endpoint definitions.
 */
export type TerrenoApi = Api<
  BaseQueryFn<unknown, unknown, unknown>,
  EndpointDefinitions,
  string,
  string
>;
