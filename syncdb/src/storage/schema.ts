import type {TablesSchema, ValuesSchema} from "tinybase";

import {SYNC_TABLES} from "./types";

/**
 * TinyBase tables schema for the local-first store. All four tables are defined
 * up front (even where operations land in later phases) so the on-disk SQLite /
 * localStorage serialization format stays stable and avoids future client-side
 * schema migrations.
 */
export const SYNC_TABLES_SCHEMA: TablesSchema = {
  [SYNC_TABLES.conflicts]: {
    collection: {type: "string"},
    createdAt: {type: "string"},
    dismissed: {default: false, type: "boolean"},
    entityId: {type: "string"},
    localData: {type: "string"},
    mutationId: {type: "string"},
    serverData: {type: "string"},
  },
  [SYNC_TABLES.cursors]: {
    cursor: {type: "string"},
    stream: {type: "string"},
    updatedAt: {type: "string"},
  },
  [SYNC_TABLES.entities]: {
    collection: {type: "string"},
    data: {type: "string"},
    deleted: {default: false, type: "boolean"},
    entityId: {type: "string"},
    updatedAt: {type: "string"},
    version: {default: "", type: "string"},
  },
  [SYNC_TABLES.outbox]: {
    args: {type: "string"},
    attemptCount: {default: 0, type: "number"},
    baseVersion: {default: "", type: "string"},
    collection: {type: "string"},
    createdAt: {type: "string"},
    entityId: {default: "", type: "string"},
    lastAttemptAt: {default: "", type: "string"},
    operation: {type: "string"},
    status: {default: "queued", type: "string"},
    userId: {default: "", type: "string"},
  },
};

/** Store-level values schema (reserved for future sync metadata). */
export const SYNC_VALUES_SCHEMA: ValuesSchema = {
  schemaVersion: {default: 1, type: "number"},
};

/** Current local schema version. Bump when the table shapes change. */
export const SYNC_SCHEMA_VERSION = 1;
