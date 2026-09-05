// noExplicitAny: the widget injects dynamically named RTK Query hooks.
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../types";

const explorerProps: Record<string, unknown> = {};
mock.module("@terreno/ui", () => {
  const RN = require("react-native");
  const ReactModule = require("react");
  return {
    AIRequestExplorer: (props: Record<string, unknown>) => {
      Object.assign(explorerProps, props);
      return ReactModule.createElement(RN.View, {testID: "mock-ai-explorer"});
    },
    Page: ({children}: {children: React.ReactNode}) =>
      ReactModule.createElement(RN.View, {}, children),
  };
});

mock.module("expo-router", () => ({router: {push: () => undefined}}));

const queryArgs: Record<string, unknown>[] = [];
const api = {
  injectEndpoints: ({endpoints}: {endpoints: (build: unknown) => Record<string, unknown>}) => {
    const definitions = endpoints({query: (definition: unknown) => definition});
    const endpoint = definitions.adminAiRequestsExplorer as {
      query: (params: Record<string, unknown>) => unknown;
    };
    endpoint.query({limit: 20, page: 1});
    return {
      useAdminAiRequestsExplorerQuery: (params: Record<string, unknown>) => {
        queryArgs.push(params);
        return {data: {data: [], total: 41}, isLoading: false};
      },
    };
  },
} as unknown as AdminApi;

import {AIRequestsScreenWidget} from "../widgets/AIRequestsScreenWidget";

const config: AdminConfigResponse = {customScreens: [], models: [], scripts: []};

describe("AIRequestsScreenWidget callbacks", () => {
  it("updates pagination and every explorer filter", async () => {
    queryArgs.length = 0;
    const rendered = renderWithTheme(
      <AIRequestsScreenWidget
        api={api}
        config={config}
        routeBase="/admin"
        screenName="ai-requests"
      />
    );
    expect(rendered.getByTestId("mock-ai-explorer")).toBeDefined();
    expect(explorerProps.totalPages).toBe(3);

    await act(async () => {
      (explorerProps.onPageChange as (page: number) => void)(2);
    });
    await act(async () => {
      (explorerProps.onRequestTypeFilterChange as (types: string[]) => void)([
        "chat",
        "completion",
      ]);
    });
    await act(async () => {
      (explorerProps.onStartDateChange as (value: string) => void)("2026-08-01");
    });
    await act(async () => {
      (explorerProps.onEndDateChange as (value: string) => void)("2026-09-01");
    });

    expect(queryArgs.at(-1)).toEqual({
      endDate: "2026-09-01",
      limit: 20,
      page: 1,
      requestType: "chat,completion",
      startDate: "2026-08-01",
    });
  });
});
