import {Platform} from "react-native";

import type {
  DataTableTestIDs,
  FieldTestIDs,
  ModalTestIDs,
  ResolvedDataTableTestIDs,
  ResolvedFieldTestIDs,
  ResolvedModalTestIDs,
  WithTestID,
} from "./types";

/** Build a dot-suffixed test id, e.g. `login.email` + `input` → `login.email.input`. */
export const resolveTestID = (base: string | undefined, part?: string): string | undefined => {
  if (!base) {
    return undefined;
  }
  if (!part) {
    return base;
  }
  return `${base}.${part}`;
};

/** React Native / RN Web test props (`testID` maps to `data-testid` on web). */
export const toTestProps = (id: string | undefined): {testID?: string} => {
  if (!id) {
    return {};
  }
  return {testID: id};
};

/** Plain DOM test props for web-only components. */
export const toDomTestProps = (id: string | undefined): {"data-testid"?: string} => {
  if (!id) {
    return {};
  }
  return {"data-testid": id};
};

/** Cross-platform test props — RN uses `testID`, web DOM uses `data-testid`. */
export const toPlatformTestProps = (
  id: string | undefined
): {testID?: string; "data-testid"?: string} => {
  if (!id) {
    return {};
  }
  if (Platform.OS === "web") {
    return {"data-testid": id};
  }
  return {testID: id};
};

/** Resolve compound field test ids with dot-suffix defaults. */
export const resolveFieldTestIDs = (
  baseTestID: string | undefined,
  testIDs?: FieldTestIDs
): ResolvedFieldTestIDs => {
  return {
    error: testIDs?.error ?? resolveTestID(baseTestID, "error"),
    helper: testIDs?.helper ?? resolveTestID(baseTestID, "helper"),
    input: testIDs?.input ?? baseTestID,
    label: testIDs?.label ?? resolveTestID(baseTestID, "label"),
  };
};

/** Resolve field test ids from component props. */
export const resolveFieldTestIDsFromProps = (
  props: WithTestID & {testIDs?: FieldTestIDs}
): ResolvedFieldTestIDs => {
  return resolveFieldTestIDs(props.testID, props.testIDs);
};

/** Resolve compound modal test ids with dot-suffix defaults. */
export const resolveModalTestIDs = (
  baseTestID: string | undefined,
  testIDs?: ModalTestIDs
): ResolvedModalTestIDs => {
  return {
    dismiss: testIDs?.dismiss ?? resolveTestID(baseTestID, "dismiss"),
    primaryButton: testIDs?.primaryButton ?? resolveTestID(baseTestID, "primary"),
    root: testIDs?.root ?? baseTestID,
    secondaryButton: testIDs?.secondaryButton ?? resolveTestID(baseTestID, "secondary"),
    title: testIDs?.title ?? resolveTestID(baseTestID, "title"),
  };
};

export const resolveModalTestIDsFromProps = (
  props: WithTestID & {testIDs?: ModalTestIDs}
): ResolvedModalTestIDs => {
  return resolveModalTestIDs(props.testID, props.testIDs);
};

/** Resolve compound DataTable test ids with dot-suffix defaults. */
export const resolveDataTableTestIDs = (
  baseTestID: string | undefined,
  testIDs?: DataTableTestIDs
): ResolvedDataTableTestIDs => {
  return {
    body: testIDs?.body ?? resolveTestID(baseTestID, "body"),
    header: testIDs?.header ?? resolveTestID(baseTestID, "header"),
    pagination: testIDs?.pagination ?? resolveTestID(baseTestID, "pagination"),
    root: testIDs?.root ?? baseTestID,
    row: testIDs?.row ?? resolveTestID(baseTestID, "row"),
  };
};

export const resolveDataTableTestIDsFromProps = (
  props: WithTestID & {testIDs?: DataTableTestIDs}
): ResolvedDataTableTestIDs => {
  return resolveDataTableTestIDs(props.testID, props.testIDs);
};

/** Row test id for DataTable — use with a stable row key, not row index alone. */
export const resolveDataTableRowTestID = (
  rowTestIDBase: string | undefined,
  rowKey: string | number
): string | undefined => {
  if (!rowTestIDBase) {
    return undefined;
  }
  return `${rowTestIDBase}-${rowKey}`;
};
