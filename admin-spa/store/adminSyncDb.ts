import type {AdminModelConfig} from "@terreno/admin-frontend";
import {
  type BetterAuthClientLike,
  betterAuthAdapter,
  createSyncDb,
  type SyncDb,
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

export const createAdminSpaSyncDb = ({
  authClient,
  collections,
  origin,
}: {
  authClient: BetterAuthClientLike;
  collections: string[];
  origin: string;
}): SyncDb =>
  createSyncDb({
    authProvider: betterAuthAdapter(authClient),
    baseUrl: origin,
    collections,
    name: `terreno-admin-spa:${origin}`,
    windowCollections: collections,
  });
