const TS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const assertTsIdentifier = ({label, value}: {label: string; value: string}): string => {
  if (!TS_IDENTIFIER.test(value)) {
    throw new Error(`Invalid ${label}: ${JSON.stringify(value)} is not a TypeScript identifier`);
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
