import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {ConflictSheet, type SyncConflictItem} from "./ConflictSheet";
import {renderWithTheme} from "./test-utils";

const buildConflict = (overrides?: Partial<SyncConflictItem>): SyncConflictItem => ({
  collection: "todos",
  entityId: "todo-1",
  localData: JSON.stringify({title: "My local title", updated: "2026-01-02T15:04:00.000Z"}),
  mutationId: "m-1",
  serverData: JSON.stringify({title: "Server title", updated: "2026-01-02T16:05:00.000Z"}),
  ...overrides,
});

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("ConflictSheet", () => {
  it("renders each conflict with local and server summaries", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <ConflictSheet
        conflicts={[buildConflict()]}
        onDismiss={() => {}}
        onResolve={() => {}}
        visible={true}
      />
    );
    expect(getByTestId("conflict-item-todo-1")).toBeTruthy();
    expect(getByText("My local title")).toBeTruthy();
    expect(getByText("Server title")).toBeTruthy();
    expect(getByTestId("conflict-local-time-todo-1")).toBeTruthy();
    expect(getByTestId("conflict-server-time-todo-1")).toBeTruthy();
    expect(getByText("Jan 2, 2026, 10:04:00 AM")).toBeTruthy();
    expect(getByText("Jan 2, 2026, 11:05:00 AM")).toBeTruthy();
  });

  it("always renders a time row when conflict payloads have no usable timestamp", () => {
    const {getAllByText} = renderWithTheme(
      <ConflictSheet
        conflicts={[
          buildConflict({
            localData: JSON.stringify({title: "Local without time"}),
            serverData: JSON.stringify({title: "Server without time"}),
          }),
        ]}
        onDismiss={() => {}}
        onResolve={() => {}}
        visible={true}
      />
    );
    expect(getAllByText("Time unavailable")).toHaveLength(2);
  });

  it("shows an empty state when there are no conflicts", () => {
    const {getByText} = renderWithTheme(
      <ConflictSheet conflicts={[]} onDismiss={() => {}} onResolve={() => {}} visible={true} />
    );
    expect(getByText("No conflicts to resolve.")).toBeTruthy();
  });

  it("calls onResolve with keepMine and dismisses when resolving the last conflict", async () => {
    const onResolve = mock(() => {});
    const onDismiss = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <ConflictSheet
        conflicts={[buildConflict()]}
        onDismiss={onDismiss}
        onResolve={onResolve}
        visible={true}
      />
    );
    fireEvent.press(getByTestId("conflict-keep-mine-button-m-1"));
    await flush();
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][0]).toEqual({mutationId: "m-1", strategy: "keepMine"});
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onResolve with useServer without dismissing when other conflicts remain", async () => {
    const onResolve = mock(() => {});
    const onDismiss = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <ConflictSheet
        conflicts={[buildConflict(), buildConflict({entityId: "todo-2", mutationId: "m-2"})]}
        onDismiss={onDismiss}
        onResolve={onResolve}
        visible={true}
      />
    );
    fireEvent.press(getByTestId("conflict-use-server-button-m-1"));
    await flush();
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][0]).toEqual({mutationId: "m-1", strategy: "useServer"});
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("uses the server version for every conflict and dismisses after confirmation", async () => {
    const onResolve = mock(() => {});
    const onDismiss = mock(() => {});
    const {findByText, getByTestId} = renderWithTheme(
      <ConflictSheet
        conflicts={[buildConflict(), buildConflict({entityId: "todo-2", mutationId: "m-2"})]}
        onDismiss={onDismiss}
        onResolve={onResolve}
        visible={true}
      />
    );

    fireEvent.press(getByTestId("conflict-use-server-all-button"));
    fireEvent.press(await findByText("Confirm"));
    await flush();

    expect(onResolve).toHaveBeenCalledTimes(2);
    expect(onResolve.mock.calls.map(([args]) => args)).toEqual([
      {mutationId: "m-1", strategy: "useServer"},
      {mutationId: "m-2", strategy: "useServer"},
    ]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("suffixes testIDs with mutationId so multiple conflicts never collide (E6, RN Testing Library strict-mode fix)", () => {
    const {getByTestId} = renderWithTheme(
      <ConflictSheet
        conflicts={[buildConflict(), buildConflict({entityId: "todo-2", mutationId: "m-2"})]}
        onDismiss={() => {}}
        onResolve={() => {}}
        visible={true}
      />
    );
    // getByTestId throws if more than one match is found — this is exactly
    // what would happen with the old shared "conflict-keep-mine-button" /
    // "conflict-use-server-button" testIDs across two rendered conflicts.
    expect(getByTestId("conflict-keep-mine-button-m-1")).toBeTruthy();
    expect(getByTestId("conflict-keep-mine-button-m-2")).toBeTruthy();
    expect(getByTestId("conflict-use-server-button-m-1")).toBeTruthy();
    expect(getByTestId("conflict-use-server-button-m-2")).toBeTruthy();
  });

  it("falls back to a JSON summary when the payload has no title", () => {
    const {getByText} = renderWithTheme(
      <ConflictSheet
        conflicts={[buildConflict({localData: JSON.stringify({completed: true})})]}
        onDismiss={() => {}}
        onResolve={() => {}}
        visible={true}
      />
    );
    expect(getByText(JSON.stringify({completed: true}))).toBeTruthy();
  });

  it("tolerates invalid JSON payloads", () => {
    const {getByTestId} = renderWithTheme(
      <ConflictSheet
        conflicts={[buildConflict({localData: "not json", serverData: "{bad"})]}
        onDismiss={() => {}}
        onResolve={() => {}}
        visible={true}
      />
    );
    expect(getByTestId("conflict-item-todo-1")).toBeTruthy();
  });
});
