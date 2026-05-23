import {describe, expect, it} from "bun:test";

import {OfflineBanner} from "./OfflineBanner";
import {renderWithTheme} from "./test-utils";

describe("OfflineBanner", () => {
  it("renders nothing when online and not syncing", () => {
    const {toJSON} = renderWithTheme(
      <OfflineBanner isOnline={true} isSyncing={false} queueLength={0} />
    );
    expect(toJSON()).toBeNull();
  });

  it("shows offline banner when not online", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <OfflineBanner isOnline={false} isSyncing={false} queueLength={0} />
    );
    expect(getByTestId("offline-banner")).toBeTruthy();
    expect(getByText("You're offline.")).toBeTruthy();
  });

  it("shows queue count in offline banner text", () => {
    const {getByText} = renderWithTheme(
      <OfflineBanner isOnline={false} isSyncing={false} queueLength={5} />
    );
    expect(
      getByText("You're offline. 5 pending changes will sync when you reconnect.")
    ).toBeTruthy();
  });

  it("shows singular 'change' for 1 pending", () => {
    const {getByText} = renderWithTheme(
      <OfflineBanner isOnline={false} isSyncing={false} queueLength={1} />
    );
    expect(
      getByText("You're offline. 1 pending change will sync when you reconnect.")
    ).toBeTruthy();
  });

  it("shows plural 'changes' for multiple pending", () => {
    const {getByText} = renderWithTheme(
      <OfflineBanner isOnline={false} isSyncing={false} queueLength={3} />
    );
    expect(
      getByText("You're offline. 3 pending changes will sync when you reconnect.")
    ).toBeTruthy();
  });

  it("shows syncing banner when isSyncing is true", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <OfflineBanner isOnline={false} isSyncing={true} queueLength={2} />
    );
    expect(getByTestId("syncing-banner")).toBeTruthy();
    expect(getByText("Syncing offline changes...")).toBeTruthy();
  });

  it("uses custom testID prop", () => {
    const {getByTestId} = renderWithTheme(
      <OfflineBanner isOnline={false} isSyncing={false} queueLength={0} testID="custom-banner" />
    );
    expect(getByTestId("custom-banner")).toBeTruthy();
  });
});
