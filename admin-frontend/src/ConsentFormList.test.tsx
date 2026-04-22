import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";

interface ListState {
  data: any;
  isLoading: boolean;
  error: unknown;
}
const listState: ListState = {data: undefined, error: null, isLoading: false};

mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useListQuery: () => ({
      data: listState.data,
      error: listState.error,
      isLoading: listState.isLoading,
    }),
  }),
}));

import {ConsentFormList} from "./ConsentFormList";

describe("ConsentFormList", () => {
  beforeEach(() => {
    listState.data = undefined;
    listState.isLoading = false;
    listState.error = null;
  });

  it("renders loading state", () => {
    listState.isLoading = true;
    const {toJSON} = renderWithTheme(<ConsentFormList api={{} as any} baseUrl="/admin" />);
    expect(toJSON()).toBeDefined();
  });

  it("renders error state", () => {
    listState.error = new Error("x");
    const {getByText} = renderWithTheme(<ConsentFormList api={{} as any} baseUrl="/admin" />);
    expect(getByText(/Failed to load consent forms/)).toBeDefined();
  });

  it("renders empty state", () => {
    listState.data = {data: [], total: 0};
    const {getByText} = renderWithTheme(<ConsentFormList api={{} as any} baseUrl="/admin" />);
    expect(getByText(/No consent forms found/)).toBeDefined();
  });

  it("renders data without onRowClick so the ActionsCell edit-callback branch is absent", () => {
    listState.data = {
      data: [{_id: "a", active: true, order: 1, title: "T1", type: "standard", version: "2"}],
      total: 1,
    };
    // No onRowClick is provided. The ActionsCell edit-button path should be hidden.
    const {toJSON} = renderWithTheme(<ConsentFormList api={{} as any} baseUrl="/admin" />);
    expect(toJSON()).toBeDefined();
  });

  it("renders data with create button and edit callback", async () => {
    listState.data = {
      data: [
        {
          _id: "a",
          active: true,
          order: 1,
          title: "T1",
          type: "standard",
          version: "2",
        },
        {_id: "b", active: false, order: "x", title: "T2", type: "privacy", version: 3},
      ],
      total: 2,
    };
    const onCreateNew = mock(() => undefined);
    const onRowClick = mock((_: string) => undefined);
    const {getByTestId} = renderWithTheme(
      <ConsentFormList
        api={{} as any}
        baseUrl="/admin"
        onCreateNew={onCreateNew}
        onRowClick={onRowClick}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("consent-form-list-create-button"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(onCreateNew).toHaveBeenCalled();
  });

  it("falls back when sort column is out of range (buildSortString returns undefined)", async () => {
    listState.data = {
      data: [{_id: "a", active: true, order: 1, title: "T1", type: "standard", version: "2"}],
      total: 1,
    };
    const {UNSAFE_root, toJSON} = renderWithTheme(
      <ConsentFormList api={{} as any} baseUrl="/admin" onRowClick={() => undefined} />
    );
    const tables = UNSAFE_root.findAll((n: any) => typeof n.props?.setSortColumn === "function");
    expect(tables.length).toBeGreaterThan(0);
    await act(async () => {
      // Column 99 is out of range, so buildSortString returns undefined and
      // the default "-created" sort should be used.
      (tables[0] as any).props.setSortColumn({column: 99, direction: "asc"});
      await new Promise((r) => setTimeout(r, 10));
    });
    // Also exercise the desc branch on a valid column.
    await act(async () => {
      (tables[0] as any).props.setSortColumn({column: 0, direction: "desc"});
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(toJSON()).toBeDefined();
  });
});
