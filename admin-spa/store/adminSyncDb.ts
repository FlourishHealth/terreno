import type {AdminModelConfig} from "@terreno/admin-frontend";
import {
  type BetterAuthReactClientLike,
  betterAuthAdapter,
  bridgeBetterAuthReactClient,
  type SyncDbConfig,
} from "@terreno/syncdb";

export const resolveAdminSyncCollections = (models: AdminModelConfig[]): string[] =>
  [
    ...new Set(
      models
        .filter(
          (model) =>
            model.adminBroadcast === true &&
            model.fields._id?.type === "string" &&
            Boolean(model.syncCollection)
        )
        .map((model) => model.syncCollection as string)
    ),
  ].sort();

/** Admin window rows get their own origin-scoped store, separate from any product client. */
export const createAdminSpaSyncDbConfig = ({
  authClient,
  collections,
  origin,
}: {
  authClient: BetterAuthReactClientLike;
  collections: string[];
  origin: string;
}): SyncDbConfig => ({
  authProvider: betterAuthAdapter(bridgeBetterAuthReactClient(authClient)),
  baseUrl: origin,
  collections,
  name: `terreno-admin-spa:${origin}`,
  windowCollections: collections,
});
