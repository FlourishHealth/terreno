import type {BetterAuthClientLike, BetterAuthGetSessionResult} from "./types";

/**
 * The Better Auth *react* client delivers session changes through a nanostore atom
 * (`$store.atoms.session`), but its `useSession` is a React hook, not the `.subscribe`
 * surface {@link betterAuthAdapter} looks for. Without the bridge the adapter falls back to
 * polling `getSession()`, producing constant `/api/auth/get-session` traffic.
 *
 * Returns a client the adapter can subscribe to, or a `getSession`-only client when the
 * atom is missing (a future Better Auth client shape change), which keeps the polling
 * fallback as the safety net.
 */
/** The only member of the Better Auth react client this bridge reads statically. */
export interface BetterAuthReactClientLike {
  getSession: () => Promise<BetterAuthGetSessionResult>;
}

interface SessionAtomLike {
  subscribe: (listener: (value: unknown) => void) => () => void;
}

export const bridgeBetterAuthReactClient = (
  authClient: BetterAuthReactClientLike
): BetterAuthClientLike => {
  const sessionAtom = (authClient as unknown as {$store?: {atoms?: {session?: SessionAtomLike}}})
    .$store?.atoms?.session;
  return {
    getSession: () => authClient.getSession(),
    ...(sessionAtom
      ? {useSession: {subscribe: (listener): (() => void) => sessionAtom.subscribe(listener)}}
      : {}),
  };
};
