/**
 * Admin stacks keep the changelist mounted under the form, so both screens can render an
 * `AdminConflictSheet` for the same collection. Only the topmost (most recently mounted)
 * instance may show the modal; otherwise one conflict opens two sheets with duplicate
 * `conflict-*` test ids.
 */
const mountedSheetIdsByCollection = new Map<string, string[]>();
const listeners = new Set<() => void>();

let nextSheetId = 0;

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const nextAdminConflictSheetId = (): string => {
  nextSheetId += 1;
  return `admin-conflict-sheet-${nextSheetId}`;
};

export const subscribeAdminConflictSheetStack = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
};

export const pushAdminConflictSheet = ({
  collection,
  sheetId,
}: {
  collection: string;
  sheetId: string;
}): void => {
  const mounted = mountedSheetIdsByCollection.get(collection) ?? [];
  if (mounted.includes(sheetId)) {
    return;
  }
  mountedSheetIdsByCollection.set(collection, [...mounted, sheetId]);
  notify();
};

export const popAdminConflictSheet = ({
  collection,
  sheetId,
}: {
  collection: string;
  sheetId: string;
}): void => {
  const mounted = mountedSheetIdsByCollection.get(collection);
  if (!mounted) {
    return;
  }
  const remaining = mounted.filter((id) => id !== sheetId);
  if (remaining.length === mounted.length) {
    return;
  }
  if (remaining.length === 0) {
    mountedSheetIdsByCollection.delete(collection);
  } else {
    mountedSheetIdsByCollection.set(collection, remaining);
  }
  notify();
};

/** True while this sheet is the topmost mounted instance for its collection. */
export const isTopAdminConflictSheet = ({
  collection,
  sheetId,
}: {
  collection: string;
  sheetId: string;
}): boolean => {
  const mounted = mountedSheetIdsByCollection.get(collection);
  if (!mounted || mounted.length === 0) {
    return false;
  }
  return mounted[mounted.length - 1] === sheetId;
};

/** @internal Test helper — drops every registered sheet. */
export const resetAdminConflictSheetStackForTests = (): void => {
  mountedSheetIdsByCollection.clear();
  notify();
};
