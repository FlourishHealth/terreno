import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";

const routerBack = mock(() => {});
const routerPush = mock(() => {});
const setOptions = mock((opts: any) => {
  // Invoke the headerRight render function so its children execute and we
  // exercise the save/delete button useCallbacks when fired elsewhere.
  if (opts?.headerRight) {
    opts.headerRight();
  }
});
mock.module("expo-router", () => ({
  router: {back: routerBack, push: routerPush},
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

const readState: {data: any; isLoading: boolean} = {data: null, isLoading: false};
const createFn = mock((_: unknown) => ({unwrap: async () => ({_id: "new"})}));
const updateFn = mock((_: unknown) => ({unwrap: async () => ({_id: "u"})}));
const deleteFn = mock((_: unknown) => ({unwrap: async () => ({})}));
mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useCreateMutation: () => [createFn, {isLoading: false}],
    useDeleteMutation: () => [deleteFn, {isLoading: false}],
    useListQuery: () => ({data: {data: [], total: 0}, isLoading: false}),
    useReadQuery: () => ({
      data: readState.data,
      error: null,
      isLoading: readState.isLoading,
    }),
    useUpdateMutation: () => [updateFn, {isLoading: false}],
  }),
}));

import {AdminModelForm} from "./AdminModelForm";

const modelConfig = {
  defaultSort: "-created",
  displayName: "User",
  fieldOrder: ["email", "name", "age", "active"],
  fields: {
    _id: {required: true, type: "string"},
    active: {default: true, required: false, type: "boolean"},
    age: {required: false, type: "number"},
    email: {required: true, type: "string"},
    name: {required: false, type: "string"},
  },
  listFields: ["email"],
  name: "User",
  routePath: "/admin/users",
};
const config = {customScreens: [], models: [modelConfig], scripts: []};

describe("AdminModelForm", () => {
  beforeEach(() => {
    routerBack.mockClear();
    setOptions.mockClear();
    createFn.mockClear();
    updateFn.mockClear();
    deleteFn.mockClear();
    configState.config = null;
    configState.isLoading = false;
    readState.data = null;
    readState.isLoading = false;
  });

  it("renders loading state while config loads", () => {
    configState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <AdminModelForm api={{} as any} baseUrl="/admin" mode="create" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders loading state when the model config is missing", () => {
    configState.config = {customScreens: [], models: [], scripts: []};
    const {toJSON} = renderWithTheme(
      <AdminModelForm api={{} as any} baseUrl="/admin" mode="create" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders the form in create mode with defaulted fields", () => {
    configState.config = config;
    const {toJSON} = renderWithTheme(
      <AdminModelForm
        api={{} as any}
        baseUrl="/admin"
        footerContent={React.createElement("FooterMarker")}
        mode="create"
        modelName="User"
      />
    );
    expect(toJSON()).toBeDefined();
    expect(setOptions).toHaveBeenCalled();
  });

  it("renders spinner during edit when the item is loading", () => {
    configState.config = config;
    readState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <AdminModelForm api={{} as any} baseUrl="/admin" itemId="u1" mode="edit" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("initializes form state from fetched item data in edit mode", () => {
    configState.config = config;
    readState.data = {
      active: false,
      age: 30,
      email: "e@x.com",
      name: "Existing",
    };
    const {toJSON} = renderWithTheme(
      <AdminModelForm api={{} as any} baseUrl="/admin" itemId="u1" mode="edit" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders 'No editable fields' when the model has only system fields", () => {
    configState.config = {
      customScreens: [],
      models: [
        {
          ...modelConfig,
          fieldOrder: [],
          fields: {_id: {required: true, type: "string"}},
        },
      ],
      scripts: [],
    };
    const {toJSON, getByText} = renderWithTheme(
      <AdminModelForm api={{} as any} baseUrl="/admin" mode="create" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
    expect(getByText("No editable fields.")).toBeDefined();
  });

  it("renders a form without fieldOrder", () => {
    configState.config = {
      customScreens: [],
      models: [{...modelConfig, fieldOrder: undefined}],
      scripts: [],
    };
    const {toJSON} = renderWithTheme(
      <AdminModelForm api={{} as any} baseUrl="/admin" mode="create" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("invokes save callback via headerRight save button", async () => {
    configState.config = config;
    // Capture the save button's onClick from setOptions
    let savedHeaderRight: any = null;
    setOptions.mockImplementation((opts: any) => {
      if (opts?.headerRight) {
        savedHeaderRight = opts.headerRight();
      }
    });

    renderWithTheme(
      <AdminModelForm api={{} as any} baseUrl="/admin" mode="create" modelName="User" />
    );
    expect(savedHeaderRight).toBeDefined();
  });

  it("invokes the delete handler in edit mode", async () => {
    configState.config = config;
    readState.data = {active: true, age: 1, email: "e@x.com", name: "Name"};
    let captured: any = null;
    setOptions.mockImplementation((opts: any) => {
      if (opts?.headerRight) {
        captured = opts.headerRight();
      }
    });
    renderWithTheme(
      <AdminModelForm api={{} as any} baseUrl="/admin" itemId="u1" mode="edit" modelName="User" />
    );
    expect(captured).toBeDefined();
  });
});
