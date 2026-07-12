import type {CellSchema, TablesSchema, ValuesSchema} from "tinybase";

import {CONFLICTS_TABLE, CURSORS_TABLE, OUTBOX_TABLE} from "./types";

/** Current local schema version. Bump when the table shapes change. */
export const SYNC_SCHEMA_VERSION = 1;

const ENTITY_TABLE_SCHEMA: Record<string, CellSchema> = {
  data: {type: "string"},
  deleted: {default: false, type: "boolean"},
  /** E5: stamped when a tombstone is first applied; "" otherwise. */
  deletedAt: {default: "", type: "string"},
  pendingMutationId: {default: "", type: "string"},
  seq: {default: 0, type: "number"},
};

/**
 * Build the TinyBase tables schema for a store configured with the given
 * collections. All reserved tables are defined up front (even where operations
 * land in later phases) so the persisted serialization format stays stable and
 * avoids client-side schema migrations.
 */
export const buildTablesSchema = ({collections}: {collections: string[]}): TablesSchema => {
  const schema: TablesSchema = {
    [CONFLICTS_TABLE]: {
      collection: {type: "string"},
      dismissed: {default: false, type: "boolean"},
      entityId: {type: "string"},
      localData: {type: "string"},
      serverData: {type: "string"},
      serverSeq: {default: 0, type: "number"},
    },
    [CURSORS_TABLE]: {
      seq: {default: 0, type: "number"},
      updatedAt: {type: "string"},
    },
    [OUTBOX_TABLE]: {
      args: {type: "string"},
      attemptCount: {default: 0, type: "number"},
      baseVersion: {type: "number"},
      collection: {type: "string"},
      createdAt: {type: "string"},
      enqueueOrder: {default: 0, type: "number"},
      entityId: {type: "string"},
      errorNackCount: {default: 0, type: "number"},
      operation: {type: "string"},
      status: {default: "queued", type: "string"},
      userId: {default: "", type: "string"},
    },
  };
  for (const collection of collections) {
    schema[collection] = {...ENTITY_TABLE_SCHEMA};
  }
  return schema;
};

/** Store-level values schema: schema version + last authenticated user. */
export const SYNC_VALUES_SCHEMA: ValuesSchema = {
  lastUserId: {default: "", type: "string"},
  /** O(1) FIFO ordering cell: the highest `enqueueOrder` handed out so far. */
  outboxMaxEnqueueOrder: {default: 0, type: "number"},
  schemaVersion: {default: SYNC_SCHEMA_VERSION, type: "number"},
};
