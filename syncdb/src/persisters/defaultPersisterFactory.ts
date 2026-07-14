import {memoryPersisterFactory} from "./memoryPersister";
import type {DefaultPersisterFactoryConfig, PersisterFactory} from "./types";

/**
 * Neutral fallback used under Node/Bun/SSR where neither expo-sqlite nor
 * IndexedDB exists. Metro/webpack resolve the platform-specific
 * `.native.ts`/`.web.ts` variants for real apps; this in-memory factory keeps
 * the client constructible (non-persistent) everywhere else.
 */
export const createDefaultPersisterFactory = (
  _config: DefaultPersisterFactoryConfig = {}
): PersisterFactory => memoryPersisterFactory;
