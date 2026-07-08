import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {SyncStatusBanner} from "./SyncStatusBanner";
import {renderWithTheme} from "./test-utils";

describe("SyncStatusBanner", () => {
  it("renders the offline indicator when offline", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <SyncStatusBanner conflictCount={0} isOnline={false} isSyncing={false} queuedCount={0} />
    );
    expect(getByTestId("sync-offline-indicator")).toBeTruthy();
    expect(queryByTestId("sync-syncing-indicator")).toBeNull();
  });

  it("hides the offline indicator when online", () => {
    const {queryByTestId} = renderWithTheme(
      <SyncStatusBanner conflictCount={0} isOnline={true} isSyncing={false} queuedCount={0} />
    );
    expect(queryByTestId("sync-offline-indicator")).toBeNull();
  });

  it("renders the queued count when there are queued mutations", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <SyncStatusBanner conflictCount={0} isOnline={true} isSyncing={false} queuedCount={3} />
    );
    expect(getByTestId("sync-queued-count")).toBeTruthy();

    const {queryByTestId: queryEmpty} = renderWithTheme(
      <SyncStatusBanner conflictCount={0} isOnline={true} isSyncing={false} queuedCount={0} />
    );
    expect(queryEmpty("sync-queued-count")).toBeNull();
    expect(queryByTestId("sync-queued-count")).toBeTruthy();
  });

  it("renders the syncing indicator while syncing", () => {
    const {getByTestId} = renderWithTheme(
      <SyncStatusBanner conflictCount={0} isOnline={true} isSyncing={true} queuedCount={0} />
    );
    expect(getByTestId("sync-syncing-indicator")).toBeTruthy();
  });

  it("renders a pressable conflict badge and calls onOpenConflicts when pressed", async () => {
    const onOpenConflicts = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <SyncStatusBanner
        conflictCount={2}
        isOnline={true}
        isSyncing={false}
        onOpenConflicts={onOpenConflicts}
        queuedCount={0}
      />
    );
    // A Box with onClick renders a Pressable whose testID gets a `-clickable` suffix. The press
    // handler awaits haptics before invoking onClick, so flush microtasks before asserting.
    const badge = getByTestId("sync-conflict-badge-clickable");
    expect(badge).toBeTruthy();
    fireEvent.press(badge);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onOpenConflicts).toHaveBeenCalledTimes(1);
  });

  it("hides the conflict badge when there are no conflicts", () => {
    const {queryByTestId} = renderWithTheme(
      <SyncStatusBanner conflictCount={0} isOnline={true} isSyncing={false} queuedCount={0} />
    );
    expect(queryByTestId("sync-conflict-badge")).toBeNull();
  });
});
