/**
 * @terreno/syncdb client for the example app.
 *
 * Authenticates with the Better Auth session from @terreno/rtk's Expo client.
 */
import {baseUrl} from "@terreno/rtk";
import {
  type BetterAuthClientLike,
  betterAuthAdapter,
  createSyncDb,
  type SyncDb,
} from "@terreno/syncdb";
import {betterAuthClient} from "@/lib/betterAuth";

export const SYNC_DB_NAME = "terreno-example";

export const SYNC_COLLECTIONS = ["todos"];

/**
 * The Better Auth *react* client delivers session changes through a nanostore atom
 * (`$store.atoms.session`), but its `useSession` is a React hook without `.subscribe`.
 * betterAuthAdapter looks for `useSession.subscribe`; without it, it falls back to
 * polling `getSession()` every 5s (constant /api/auth/get-session traffic). Bridge the
 * atom to the shape the adapter expects so auth changes are event-driven instead.
 */
type SessionAtomLike = {subscribe: (listener: (value: unknown) => void) => () => void};
const sessionAtom = (
  betterAuthClient as unknown as {$store?: {atoms?: {session?: SessionAtomLike}}}
).$store?.atoms?.session;

const syncAuthClient: BetterAuthClientLike = {
  getSession: () => betterAuthClient.getSession(),
  ...(sessionAtom
    ? {useSession: {subscribe: (listener): (() => void) => sessionAtom.subscribe(listener)}}
    : {}),
};

// pollIntervalMs is only used as a fallback if the session atom bridge above is
// unavailable (e.g. a future Better Auth client shape change); keep it slow.
const authProvider = betterAuthAdapter(syncAuthClient, {pollIntervalMs: 60_000});

/**
 * Singleton local-first client. Started/stopped by the root layout when the user is
 * authenticated; wipe-on-user-change is handled internally.
 *
 * `debug` enables the in-memory sync event log in dev builds only — it powers the
 * `/syncdb-debug` debugger screen (and, in the future, MCP introspection). It is
 * off in production so there is zero recording overhead.
 */
export const syncDb: SyncDb = createSyncDb({
  authProvider,
  baseUrl,
  collections: SYNC_COLLECTIONS,
  debug: __DEV__ ? {capacity: 1000} : false,
  // haltQueueOnConflict: true — the example app is a template other apps grow
  // from, and it's common to add cross-collection references (e.g. a todo
  // referencing a project id) as the schema grows. The default per-entity
  // conflict policy already blocks a queued mutation whose args reference a
  // currently-blocked entity's id (see the syncdb README "Cross-collection
  // reference blocking"), but that only covers references present in `args`;
  // opting into a whole-drain halt here is the stronger, simpler guarantee
  // for a starter app whose data model isn't fixed yet. Flip to `false` (the
  // package default) once your entities are truly independent and you want a
  // conflict on one to never stall unrelated ones.
  haltQueueOnConflict: true,
  name: SYNC_DB_NAME,
});
