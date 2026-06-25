import {Platform} from "react-native";

import type {
  DataTableTestIds,
  FieldTestIds,
  ModalTestIds,
  ResolvedDataTableTestIds,
  ResolvedFieldTestIds,
  ResolvedModalTestIds,
  WithTestId,
} from "./types";

/** Prefer `testId`, fall back to legacy `testID`. */
export const pickTestId = ({testId, testID}: WithTestId = {}): string | undefined => {
  return testId ?? testID;
};

/** Build a dot-suffixed test id, e.g. `login.email` + `input` → `login.email.input`. */
export const resolveTestId = (base: string | undefined, part?: string): string | undefined => {
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
export const resolveFieldTestIds = (
  baseTestId: string | undefined,
  testIds?: FieldTestIds
): ResolvedFieldTestIds => {
  return {
    error: testIds?.error ?? resolveTestId(baseTestId, "error"),
    helper: testIds?.helper ?? resolveTestId(baseTestId, "helper"),
    input: testIds?.input ?? baseTestId,
    label: testIds?.label ?? resolveTestId(baseTestId, "label"),
  };
};

/** Resolve field test ids from props that may use either `testId` or `testID`. */
export const resolveFieldTestIdsFromProps = (
  props: WithTestId & {testIds?: FieldTestIds}
): ResolvedFieldTestIds => {
  return resolveFieldTestIds(pickTestId(props), props.testIds);
};

/** Resolve compound modal test ids with dot-suffix defaults. */
export const resolveModalTestIds = (
  baseTestId: string | undefined,
  testIds?: ModalTestIds
): ResolvedModalTestIds => {
  return {
    dismiss: testIds?.dismiss ?? resolveTestId(baseTestId, "dismiss"),
    primaryButton: testIds?.primaryButton ?? resolveTestId(baseTestId, "primary"),
    root: testIds?.root ?? baseTestId,
    secondaryButton: testIds?.secondaryButton ?? resolveTestId(baseTestId, "secondary"),
    title: testIds?.title ?? resolveTestId(baseTestId, "title"),
  };
};

export const resolveModalTestIdsFromProps = (
  props: WithTestId & {testIds?: ModalTestIds}
): ResolvedModalTestIds => {
  return resolveModalTestIds(pickTestId(props), props.testIds);
};

/** Resolve compound DataTable test ids with dot-suffix defaults. */
export const resolveDataTableTestIds = (
  baseTestId: string | undefined,
  testIds?: DataTableTestIds
): ResolvedDataTableTestIds => {
  return {
    body: testIds?.body ?? resolveTestId(baseTestId, "body"),
    header: testIds?.header ?? resolveTestId(baseTestId, "header"),
    pagination: testIds?.pagination ?? resolveTestId(baseTestId, "pagination"),
    root: testIds?.root ?? baseTestId,
    row: testIds?.row ?? resolveTestId(baseTestId, "row"),
  };
};

export const resolveDataTableTestIdsFromProps = (
  props: WithTestId & {testIds?: DataTableTestIds}
): ResolvedDataTableTestIds => {
  return resolveDataTableTestIds(pickTestId(props), props.testIds);
};

/** Row test id for DataTable — use with a stable row key, not row index alone. */
export const resolveDataTableRowTestId = (
  rowTestIdBase: string | undefined,
  rowKey: string | number
): string | undefined => {
  if (!rowTestIdBase) {
    return undefined;
  }
  return `${rowTestIdBase}-${rowKey}`;
};
