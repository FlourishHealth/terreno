import {describe, expect, it} from "bun:test";

import {OfflineConflictCard} from "./OfflineConflictCard";
import {renderWithTheme} from "./test-utils";

describe("OfflineConflictCard", () => {
  const conflict = {
    dismissed: false,
    id: "conflict-1",
    localArgs: {body: {title: "Local"}},
    modelName: "Todo",
    serverValue: {title: "Server"},
  };

  it("renders local and server values with action buttons", () => {
    const onKeepMine = (): void => {};
    const onUseServer = (): void => {};

    const {getByTestId, getByText} = renderWithTheme(
      <OfflineConflictCard conflict={conflict} onKeepMine={onKeepMine} onUseServer={onUseServer} />
    );

    expect(getByTestId("conflict-notification")).toBeTruthy();
    expect(getByText("Keep mine")).toBeTruthy();
    expect(getByText("Use server")).toBeTruthy();
    expect(getByText(/Local/)).toBeTruthy();
    expect(getByText(/Server/)).toBeTruthy();
  });
});
