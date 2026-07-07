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
 * On a successful claim, `claimFirstAdmin` resets the entire RTK Query cache
 * (`api.util.resetApiState()`) rather than only invalidating `getAdminSetupStatus`.
 * The visitor just transitioned from anonymous/non-admin to admin, so every other
 * cached response is now stale too — most notably `@terreno/admin-frontend`'s
 * dynamically-injected `adminConfig` query (`GET {apiBase}/config`, used by
 * `AdminGate` to decide `isForbidden`/`isAdmin`), which was very likely cached as a
 * 403 from before the claim and carries no tags this module could invalidate
 * directly. Without the reset, `AdminGate` would derive `isForbidden` from that stale
 * 403 and redirect the freshly-promoted admin to `/forbidden` instead of `/`. Active
 * subscribers (AdminGate's `useGetAdminSetupStatusQuery` and `useAdminConfig`) refetch
 * automatically once their cache entries are cleared, so the gate briefly shows its
 * loading state instead of bouncing to the wrong screen.
 */
export const openapi = createSessionApi()
  .enhanceEndpoints({
    addTagTypes: ["admin-models", "admin-version-config", "admin-scripts", "profile"],
  })
  .injectEndpoints({
    endpoints: (build) => ({
      claimFirstAdmin: build.mutation<AdminSetupClaimResponse, {apiBase: string}>({
        onQueryStarted: async (_args, {dispatch, queryFulfilled}) => {
          try {
            await queryFulfilled;
            dispatch(openapi.util.resetApiState());
          } catch {
            // Claim failed; leave the cache untouched.
          }
        },
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
