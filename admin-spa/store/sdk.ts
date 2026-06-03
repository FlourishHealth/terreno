import type {AdminScreenProps} from "@terreno/admin-frontend";
import {emptySplitApi} from "@terreno/rtk";

/**
 * Base RTK Query API for the admin SPA. Admin CRUD endpoints are injected at runtime
 * by `@terreno/admin-frontend`'s `useAdminApi`/`useAdminConfig` hooks, so no codegen is
 * required for the admin flow itself. We only declare the cache tag types those hooks
 * (and any consumer extensions) expect.
 */
export const openapi = emptySplitApi.enhanceEndpoints({
  addTagTypes: ["admin-models", "admin-version-config", "admin-scripts", "profile"],
});

/**
 * The API instance passed to `@terreno/admin-frontend` screens. Cast to the
 * type-erased `AdminApi` the admin screens accept (RTK's `Api` generics, including the
 * tag-type `unique symbol`s, don't structurally match the `Api<any, ...>` alias).
 */
export const terrenoApi = openapi as unknown as AdminScreenProps["api"];
