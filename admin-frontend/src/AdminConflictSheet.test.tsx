import {describe, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";

import {AdminConflictSheet} from "./AdminConflictSheet";

const createConflict = ({
  collection = "todos",
  entityId = "todo-1",
  mutationId = "mutation-1",
}: {
  collection?: string;
  entityId?: string;
  mutationId?: string;
} = {}) => ({
  collection,
  entityId,
  localData: JSON.stringify({title: "My Todo"}),
  mutationId,
  serverData: JSON.stringify({title: "Server Todo"}),
});

describe("AdminConflictSheet", () => {
  it("shows only admin-loaded conflicts and forwards both resolution strategies", async () => {
    const resolve = mock((_args: {mutationId: string; strategy: "keepMine" | "useServer"}) => {});
    const view = renderWithTheme(
      <AdminConflictSheet
        collection="todos"
        conflicts={[
          createConflict(),
          createConflict({entityId: "todo-2", mutationId: "mutation-2"}),
          createConflict({collection: "users", entityId: "user-1", mutationId: "mutation-3"}),
        ]}
        loadedIds={["todo-1"]}
        resolve={resolve}
      />
    );

    assert.isDefined(await view.findByTestId("conflict-item-todo-1"));
    assert.isNull(view.queryByTestId("conflict-item-todo-2"));
    assert.isNull(view.queryByTestId("conflict-item-user-1"));

    await act(async () => {
      fireEvent.press(view.getByTestId("conflict-keep-mine-button-mutation-1"));
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 600));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("conflict-use-server-button-mutation-1"));
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 600));
    });
    assert.deepEqual(
      resolve.mock.calls.map(([args]) => args),
      [
        {mutationId: "mutation-1", strategy: "keepMine"},
        {mutationId: "mutation-1", strategy: "useServer"},
      ]
    );
  });

  it("stays hidden when no conflicted id is loaded in the admin window", () => {
    const view = renderWithTheme(
      <AdminConflictSheet
        collection="todos"
        conflicts={[createConflict()]}
        loadedIds={[]}
        resolve={() => {}}
      />
    );

    assert.isNull(view.queryByTestId("admin-conflict-sheet"));
  });
});
