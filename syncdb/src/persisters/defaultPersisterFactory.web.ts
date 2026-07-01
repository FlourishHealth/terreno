import type {MergeableStore} from "tinybase";
import {createLocalPersister} from "tinybase/persisters/persister-browser";

import {adaptPersister} from "./adapt";
import type {DefaultPersisterOptions, SyncDbPersister, SyncDbPersisterFactory} from "./types";

/**
 * Web default persister: stores the (mergeable) TinyBase content in
 * localStorage, per the Expo local-first guide's web recommendation.
 */
export const createDefaultPersisterFactory = ({
  databaseName = "terreno-syncdb",
}: DefaultPersisterOptions = {}): SyncDbPersisterFactory => {
  return (store: MergeableStore): SyncDbPersister =>
    adaptPersister(createLocalPersister(store, databaseName));
};
