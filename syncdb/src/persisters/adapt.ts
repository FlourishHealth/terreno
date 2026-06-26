import type {RawPersister, SyncDbPersister} from "./types";

/**
 * Adapt a TinyBase-style persister (whose methods return the persister for
 * chaining) to the narrower {@link SyncDbPersister} contract with `void`
 * promises. Keeps platform persister wrappers free of return-type variance
 * juggling.
 */
export const adaptPersister = (persister: RawPersister): SyncDbPersister => ({
  destroy: (): void => {
    persister.destroy();
  },
  load: async (): Promise<void> => {
    await persister.load();
  },
  save: async (): Promise<void> => {
    await persister.save();
  },
  startAutoSave: async (): Promise<void> => {
    await persister.startAutoSave();
  },
  stopAutoSave: (): void => {
    persister.stopAutoSave();
  },
});
