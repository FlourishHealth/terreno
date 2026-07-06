import type {AdminScreenProps} from "@terreno/admin-frontend";
import {createSessionApi} from "@terreno/rtk";

export interface AdminSetupStatusResponse {
  /** True when no admin user exists yet and the first-admin setup flow should be shown. */
  needsSetup: boolean;
}

export interface AdminSetupClaimResponse {
  admin: boolean;
}

/**
 * Base RTK Query API for the admin SPA. Admin CRUD endpoints are injected at runtime
 * by `@terreno/admin-frontend`'s `useAdminApi`/`useAdminConfig` hooks, so no codegen is
 * required for the admin flow itself. We only declare the cache tag types those hooks
 * (and any consumer extensions) expect.
 *
 * Uses the cookie-session API (NOT `emptySplitApi`): the SPA authenticates with the
 * better-auth session cookie on the same origin, and `emptySplitApi`'s JWT base query
 * would dispatch a global logout (killing the better-auth session) whenever no bearer
 * token is found in storage.
 *
 * Also injects the first-admin setup endpoints (`GET {apiBase}/setup-status`,
 * `POST {apiBase}/setup-claim`) exposed by `@terreno/admin-backend`'s `AdminApp` when
 * `firstAdminSetup` is configured. Declared here (rather than dynamically like the
 * admin-frontend hooks) since the setup gate needs typed hooks before any model config
 * is known.
 */
export const openapi = createSessionApi()
  .enhanceEndpoints({
    addTagTypes: ["admin-models", "admin-version-config", "admin-scripts", "profile"],
  })
  .injectEndpoints({
    endpoints: (build) => ({
      claimFirstAdmin: build.mutation<AdminSetupClaimResponse, {apiBase: string}>({
        query: ({apiBase}) => ({method: "POST", url: `${apiBase}/setup-claim`}),
      }),
      getAdminSetupStatus: build.query<AdminSetupStatusResponse, {apiBase: string}>({
        query: ({apiBase}) => ({method: "GET", url: `${apiBase}/setup-status`}),
      }),
    }),
  });

export const {useClaimFirstAdminMutation, useGetAdminSetupStatusQuery} = openapi;

/**
 * The API instance passed to `@terreno/admin-frontend` screens. Cast to the
 * type-erased `AdminApi` the admin screens accept (RTK's `Api` generics, including the
 * tag-type `unique symbol`s, don't structurally match the `Api<any, ...>` alias).
 */
export const terrenoApi = openapi as unknown as AdminScreenProps["api"];
