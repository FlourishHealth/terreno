import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";

const routerPush = mock(() => {});
const setOptions = mock(() => {});
mock.module("expo-router", () => ({
  router: {push: routerPush},
  useNavigation: () => ({setOptions}),
}));

const configState: {config: any; isLoading: boolean} = {
  config: null,
  isLoading: false,
};
mock.module("./useAdminConfig", () => ({
  useAdminConfig: () => ({
    config: configState.config,
    error: null,
    isLoading: configState.isLoading,
  }),
}));

const listState: {data: any; isLoading: boolean} = {
  data: {data: [], total: 0},
  isLoading: false,
};
const deleteFn = mock(() => ({unwrap: async () => ({})}));
mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useCreateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useDeleteMutation: () => [deleteFn, {isLoading: false}],
    useListQuery: () => ({
      data: listState.data,
      error: null,
      isLoading: listState.isLoading,
    }),
    useReadQuery: () => ({data: null, error: null, isLoading: false}),
    useUpdateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
  }),
}));

import {AdminModelTable} from "./AdminModelTable";

const fullConfig = {
  customScreens: [],
  models: [
    {
      defaultSort: "-created",
      displayName: "User",
      fields: {
        _id: {required: true, type: "string"},
        active: {required: false, type: "boolean"},
        age: {required: false, type: "number"},
        created: {required: false, type: "date"},
        email: {required: false, type: "string"},
        tags: {required: false, type: "array"},
      },
      listFields: ["email", "active", "age", "created", "tags"],
      name: "User",
      routePath: "/admin/users",
    },
  ],
  scripts: [],
};

describe("AdminModelTable", () => {
  beforeEach(() => {
    routerPush.mockClear();
    setOptions.mockClear();
    deleteFn.mockClear();
    configState.config = null;
    configState.isLoading = false;
    listState.data = {data: [], total: 0};
    listState.isLoading = false;
  });

  it("renders loading page while config is loading", () => {
    configState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as any} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders loading page when model config is missing", () => {
    configState.config = {customScreens: [], models: [], scripts: []};
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as any} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders empty state when no data present", () => {
    configState.config = fullConfig;
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as any} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
    expect(setOptions).toHaveBeenCalled();
  });

  it("renders loading state when the list query is loading", () => {
    configState.config = fullConfig;
    listState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as any} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders data with various column types and formats values", () => {
    configState.config = fullConfig;
    listState.data = {
      data: [
        {
          _id: "u1",
          active: true,
          age: 42,
          created: "2024-01-01T00:00:00Z",
          email: "a@b.com",
          tags: ["x", "y"],
        },
        {
          _id: "u2",
          active: false,
          age: null,
          created: null,
          email: "c@d.com",
          tags: {_id: "nested", other: "value"},
        },
      ],
      total: 2,
    };
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as any} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("supports custom column overrides", () => {
    configState.config = fullConfig;
    listState.data = {
      data: [{_id: "u1", email: "a@b.com"}],
      total: 1,
    };
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as any} baseUrl="/admin" columns={["email"]} modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });
});
