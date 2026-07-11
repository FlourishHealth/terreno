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

  it("renders a pressable paused-for-auth indicator and calls onAuthRequired when pressed", async () => {
    const onAuthRequired = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <SyncStatusBanner
        conflictCount={0}
        isOnline={true}
        isSyncing={false}
        onAuthRequired={onAuthRequired}
        paused="auth"
        queuedCount={0}
      />
    );
    const badge = getByTestId("sync-paused-auth-indicator-clickable");
    expect(badge).toBeTruthy();
    fireEvent.press(badge);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });

  it("hides the paused-for-auth indicator when not paused", () => {
    const {queryByTestId} = renderWithTheme(
      <SyncStatusBanner conflictCount={0} isOnline={true} isSyncing={false} queuedCount={0} />
    );
    expect(queryByTestId("sync-paused-auth-indicator")).toBeNull();
    expect(queryByTestId("sync-paused-auth-indicator-clickable")).toBeNull();
  });

  it("renders a pressable failed badge and calls onOpenFailed when pressed", async () => {
    const onOpenFailed = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <SyncStatusBanner
        conflictCount={0}
        failedCount={2}
        isOnline={true}
        isSyncing={false}
        onOpenFailed={onOpenFailed}
        queuedCount={0}
      />
    );
    const badge = getByTestId("sync-failed-badge-clickable");
    expect(badge).toBeTruthy();
    fireEvent.press(badge);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onOpenFailed).toHaveBeenCalledTimes(1);
  });

  it("hides the failed badge when there are no failed mutations", () => {
    const {queryByTestId} = renderWithTheme(
      <SyncStatusBanner conflictCount={0} isOnline={true} isSyncing={false} queuedCount={0} />
    );
    expect(queryByTestId("sync-failed-badge")).toBeNull();
  });

  it("shows queued count when queued is at or below the progress threshold, even while draining", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <SyncStatusBanner
        conflictCount={0}
        draining={true}
        isOnline={true}
        isSyncing={true}
        queuedCount={5}
        sentThisDrain={1}
        totalThisDrain={5}
      />
    );
    expect(getByTestId("sync-queued-count")).toBeTruthy();
    expect(queryByTestId("sync-drain-progress")).toBeNull();
  });

  it("switches to numeric drain progress once queued exceeds the progress threshold while draining", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <SyncStatusBanner
        conflictCount={0}
        draining={true}
        isOnline={true}
        isSyncing={true}
        queuedCount={40}
        sentThisDrain={12}
        totalThisDrain={40}
      />
    );
    const progress = getByTestId("sync-drain-progress");
    expect(progress).toBeTruthy();
    expect(queryByTestId("sync-queued-count")).toBeNull();
  });

  it("does not show drain progress when queued is large but not currently draining", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <SyncStatusBanner
        conflictCount={0}
        draining={false}
        isOnline={true}
        isSyncing={false}
        queuedCount={40}
        sentThisDrain={0}
        totalThisDrain={0}
      />
    );
    expect(getByTestId("sync-queued-count")).toBeTruthy();
    expect(queryByTestId("sync-drain-progress")).toBeNull();
  });
});
