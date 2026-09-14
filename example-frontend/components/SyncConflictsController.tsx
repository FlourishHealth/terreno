/**
 * App-wide ownership of the conflict-resolution sheet.
 *
 * Two surfaces can ask the user to resolve sync conflicts: the Resolve button on a
 * SyncHealthToast, and the conflict badge in SyncTodosScreen's SyncStatusBanner. Both
 * used to render their own <ConflictSheet>, so with a toast and the todos screen live at
 * once every `conflict-*` testID matched twice (an RN-Testing-Library / Playwright
 * strict-mode failure) and the two sheets could disagree about what was open.
 *
 * This context holds only which collection the sheet is scoped to, so it has no syncdb
 * dependency and can be provided above both the SyncDbProvider subtree that renders the
 * toasts and the Expo Router Stack that renders the screens. SyncHealthToast owns the one
 * <ConflictSheet> instance (via its `renderConflictsModal` prop) and reads this state;
 * screens only request an open.
 */
import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export interface SyncConflictsController {
  /** Collection the sheet is scoped to, or null when the sheet is closed. */
  requestedCollection: string | null;
  /** Open the single conflict sheet, scoped to one collection's conflicts. */
  openConflicts: (collection: string) => void;
  closeConflicts: () => void;
}

const SyncConflictsContext = createContext<SyncConflictsController | null>(null);

export const SyncConflictsProvider: FC<{children: ReactNode}> = ({children}) => {
  const [requestedCollection, setRequestedCollection] = useState<string | null>(null);

  const openConflicts = useCallback((collection: string): void => {
    setRequestedCollection(collection);
  }, []);

  const closeConflicts = useCallback((): void => {
    setRequestedCollection(null);
  }, []);

  const value = useMemo(
    (): SyncConflictsController => ({closeConflicts, openConflicts, requestedCollection}),
    [closeConflicts, openConflicts, requestedCollection]
  );

  return <SyncConflictsContext.Provider value={value}>{children}</SyncConflictsContext.Provider>;
};

/** Access the conflict-sheet controller; throws when no provider is mounted. */
export const useSyncConflictsController = (): SyncConflictsController => {
  const controller = useContext(SyncConflictsContext);
  if (!controller) {
    throw new Error(
      "useSyncConflictsController must be used within a <SyncConflictsProvider>. " +
        "It is mounted in app/_layout.tsx around both the sync toasts and the router Stack."
    );
  }
  return controller;
};
