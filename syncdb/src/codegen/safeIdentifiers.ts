const TS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SYNC_COLLECTION = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const assertTsIdentifier = ({label, value}: {label: string; value: string}): string => {
  if (!TS_IDENTIFIER.test(value)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(value)} is not a TypeScript identifier`);
  }
  return value;
};

/** Sync collection tags may use hyphens (e.g. notification-preferences) but must be safe in JSON strings. */
export const assertSyncCollectionName = ({
  label,
  value,
}: {
  label: string;
  value: string;
}): string => {
  if (!SYNC_COLLECTION.test(value)) {
    throw new Error(
      `Invalid ${label}: ${JSON.stringify(value)} is not a valid sync collection name`
    );
  }
  return value;
};

export const emitTsString = (value: string): string => JSON.stringify(value);

export const emitTsPropertyKey = (key: string): string => {
  if (TS_IDENTIFIER.test(key)) {
    return key;
  }
  return JSON.stringify(key);
};
