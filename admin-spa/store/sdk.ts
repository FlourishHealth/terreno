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
 *
 * `claimFirstAdmin` both patches the cached `getAdminSetupStatus` result to
 * `needsSetup: false` synchronously on success (`onQueryStarted`) and invalidates the
 * `admin-setup-status` tag (background refetch, reconciling with the server as the
 * source of truth). The synchronous patch closes the race between the mutation
 * resolving and `AdminGate`'s immediate post-claim `router.replace("/")` — without it,
 * the gate would briefly re-derive `needsSetup: true` from stale cached data and bounce
 * back to `/setup`.
 */
export const openapi = createSessionApi()
  .enhanceEndpoints({
    addTagTypes: [
      "admin-models",
      "admin-version-config",
      "admin-scripts",
      "admin-setup-status",
      "profile",
    ],
  })
  .injectEndpoints({
    endpoints: (build) => ({
      claimFirstAdmin: build.mutation<AdminSetupClaimResponse, {apiBase: string}>({
        invalidatesTags: ["admin-setup-status"],
        onQueryStarted: async ({apiBase}, {dispatch, queryFulfilled}) => {
          try {
            await queryFulfilled;
            dispatch(
              openapi.util.updateQueryData("getAdminSetupStatus", {apiBase}, (draft) => {
                draft.needsSetup = false;
              })
            );
          } catch {
            // Claim failed; leave the cached setup-status untouched.
          }
        },
        query: ({apiBase}) => ({method: "POST", url: `${apiBase}/setup-claim`}),
      }),
      getAdminSetupStatus: build.query<AdminSetupStatusResponse, {apiBase: string}>({
        providesTags: ["admin-setup-status"],
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
