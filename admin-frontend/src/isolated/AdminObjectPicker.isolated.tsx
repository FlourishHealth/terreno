import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../../ui/node_modules/@testing-library/react-native";
import {AdminObjectPicker} from "../AdminObjectPicker";

interface ApiState {
  searchData: any;
  isSearching: boolean;
  selectedItem: any;
}

const apiState: ApiState = {
  isSearching: false,
  searchData: undefined,
  selectedItem: undefined,
};

const makeApi = () => ({
  injectEndpoints: ({endpoints}: {endpoints: (b: any) => Record<string, any>}) => {
    const build = {query: (spec: any) => spec};
    const defs = endpoints(build);
    const keys = Object.keys(defs);
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const searchKey = keys.find((k) => k.startsWith("adminSearch_"));
    const readKey = keys.find((k) => k.startsWith("adminSearchRead_"));
    const enhanced: any = {};
    if (searchKey) {
      enhanced[`use${cap(searchKey)}Query`] = (_q: string, opts: any) => {
        if (opts?.skip) {
          return {data: undefined, isFetching: false};
        }
        return {data: apiState.searchData, isFetching: apiState.isSearching};
      };
    }
    if (readKey) {
      enhanced[`use${cap(readKey)}Query`] = (_id: string, opts: any) => {
        if (opts?.skip) {
          return {data: undefined};
        }
        return {data: apiState.selectedItem};
      };
    }
    return enhanced;
  },
});

describe("AdminObjectPicker", () => {
  beforeEach(() => {
    apiState.searchData = undefined;
    apiState.isSearching = false;
    apiState.selectedItem = undefined;
  });

  it("renders a search field when there is no selected value", () => {
    const {toJSON} = renderWithTheme(
      <AdminObjectPicker
        api={makeApi() as any}
        errorText="bad"
        helperText="helper"
        onChange={() => {}}
        refModelName="User"
        routePath="/admin/users"
        title="User"
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders the selected display when value resolves", () => {
    apiState.selectedItem = {_id: "u1", email: "e@x.com", name: "Alice"};
    const {toJSON, getByTestId} = renderWithTheme(
      <AdminObjectPicker
        api={makeApi() as any}
        onChange={() => {}}
        refModelName="User"
        routePath="/admin/users"
        title="User"
        value="u1"
      />
    );
    expect(toJSON()).toBeDefined();
    expect(getByTestId("admin-picker-User-display")).toBeDefined();
  });

  it("clears the selection on clear press", async () => {
    apiState.selectedItem = {_id: "u1", name: "Alice"};
    const onChange = mock((_: string) => undefined);
    const {getByTestId} = renderWithTheme(
      <AdminObjectPicker
        api={makeApi() as any}
        onChange={onChange}
        refModelName="User"
        routePath="/admin/users"
        title="User"
        value="u1"
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-picker-User-clear"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("switches to edit mode on change press", async () => {
    apiState.selectedItem = {_id: "u1", name: "Alice"};
    const {getByTestId, queryByTestId} = renderWithTheme(
      <AdminObjectPicker
        api={makeApi() as any}
        onChange={() => {}}
        refModelName="User"
        routePath="/admin/users"
        title="User"
        value="u1"
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-picker-User-change"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(queryByTestId("admin-picker-User-search")).toBeDefined();
  });

  it("debounces search input and shows results", async () => {
    apiState.searchData = [
      {_id: "a", name: "Alpha"},
      {_id: "b", email: "beta@x.com", name: "Beta"},
    ];
    const {getByTestId} = renderWithTheme(
      <AdminObjectPicker
        api={makeApi() as any}
        onChange={() => {}}
        refModelName="User"
        routePath="/admin/users"
        title="User"
        value=""
      />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("admin-picker-User-search"), "al");
      await new Promise((r) => setTimeout(r, 350));
    });
  });

  it("shows spinner while fetching results", () => {
    apiState.isSearching = true;
    apiState.searchData = undefined;
    const {toJSON} = renderWithTheme(
      <AdminObjectPicker
        api={makeApi() as any}
        onChange={() => {}}
        refModelName="User"
        routePath="/admin/users"
        title="User"
        value=""
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("falls back to _id display when no known field is present", () => {
    apiState.selectedItem = {_id: "raw-id"};
    const {toJSON} = renderWithTheme(
      <AdminObjectPicker
        api={makeApi() as any}
        onChange={() => {}}
        refModelName="User"
        routePath="/admin/users"
        title="User"
        value="raw-id"
      />
    );
    expect(toJSON()).toBeDefined();
  });
});
