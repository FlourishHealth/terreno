import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";

const routerBack = mock(() => {});
mock.module("expo-router", () => ({
  router: {back: routerBack},
}));

interface ApiState {
  data: any;
  error: unknown;
  isLoading: boolean;
  updateImpl: (body: any) => Promise<any>;
}

const apiState: ApiState = {
  data: null,
  error: null,
  isLoading: false,
  updateImpl: async () => ({}),
};

const updateCalls: any[] = [];
const makeApi = () => ({
  injectEndpoints: ({endpoints}: {endpoints: (b: any) => Record<string, any>}) => {
    const build = {
      mutation: (spec: any) => spec,
      query: (spec: any) => spec,
    };
    endpoints(build);
    return {
      useAdminVersionConfigQuery: () => ({
        data: apiState.data,
        error: apiState.error,
        isLoading: apiState.isLoading,
      }),
      useUpdateVersionConfigMutation: () => [
        (body: any) => ({
          unwrap: async () => {
            updateCalls.push(body);
            return apiState.updateImpl(body);
          },
        }),
        {isLoading: false},
      ],
    };
  },
});

import {AdminVersionConfig} from "./AdminVersionConfig";

describe("AdminVersionConfig", () => {
  beforeEach(() => {
    routerBack.mockClear();
    updateCalls.length = 0;
    apiState.data = null;
    apiState.error = null;
    apiState.isLoading = false;
    apiState.updateImpl = async () => ({});
  });

  it("renders loading state", () => {
    apiState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <AdminVersionConfig api={makeApi() as any} baseUrl="/admin" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders error state and calls back on press", async () => {
    apiState.error = new Error("boom");
    const {getByText} = renderWithTheme(
      <AdminVersionConfig api={makeApi() as any} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.press(getByText("Back"));
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(routerBack).toHaveBeenCalled();
  });

  it("populates the form with defaults when data is missing", () => {
    apiState.data = null;
    const {toJSON} = renderWithTheme(
      <AdminVersionConfig api={makeApi() as any} baseUrl="/admin" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("populates form state from backend data and saves", async () => {
    apiState.data = {
      mobileRequiredVersion: 1,
      mobileWarningVersion: 2,
      requiredMessage: "R",
      updateUrl: " https://x.com ",
      warningMessage: "W",
      webRequiredVersion: 3,
      webWarningVersion: 4,
    };
    const {getByText} = renderWithTheme(
      <AdminVersionConfig api={makeApi() as any} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.press(getByText("Save"));
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].updateUrl).toBe("https://x.com");
  });

  it("handles save failures gracefully", async () => {
    apiState.data = {};
    apiState.updateImpl = async () => {
      throw new Error("server down");
    };
    const {getByText} = renderWithTheme(
      <AdminVersionConfig api={makeApi() as any} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.press(getByText("Save"));
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(updateCalls.length).toBe(1);
  });

  it("sets updateUrl to null when empty", async () => {
    apiState.data = {updateUrl: null};
    const {getByText} = renderWithTheme(
      <AdminVersionConfig api={makeApi() as any} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.press(getByText("Save"));
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(updateCalls[0].updateUrl).toBeNull();
  });
});
