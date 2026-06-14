import {describe, expect, it} from "bun:test";

import {OfflineConflictList} from "./OfflineConflictList";
import {renderWithTheme} from "./test-utils";

describe("OfflineConflictList", () => {
  it("renders unresolved conflicts and hides dismissed ones", () => {
    const onResolve = (): void => {};

    const {getByTestId, queryByTestId} = renderWithTheme(
      <OfflineConflictList
        conflicts={[
          {
            dismissed: false,
            id: "conflict-open",
            localArgs: {title: "Local"},
            modelName: "Todo",
            serverValue: {title: "Server"},
          },
          {
            dismissed: true,
            id: "conflict-closed",
            localArgs: {title: "Old"},
            modelName: "Todo",
            serverValue: {title: "Old Server"},
          },
        ]}
        onResolve={onResolve}
      />
    );

    expect(getByTestId("offline-conflict-list")).toBeTruthy();
    expect(getByTestId("offline-conflict-card-conflict-open")).toBeTruthy();
    expect(queryByTestId("offline-conflict-card-conflict-closed")).toBeNull();
  });
});
