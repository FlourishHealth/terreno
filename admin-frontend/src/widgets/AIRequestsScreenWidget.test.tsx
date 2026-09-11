// noExplicitAny: the RTK Query host API is intentionally type-erased in this widget test.
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../types";
import {AI_ADMIN_WIDGETS, AIRequestsScreenWidget} from "./AIRequestsScreenWidget";

const queryRequests: Record<string, unknown>[] = [];

const createAdminApi = (): AdminApi => {
  const api = {
    injectEndpoints: ({endpoints}: {endpoints: (build: unknown) => Record<string, unknown>}) => {
      const definitions = endpoints({query: (definition: unknown) => definition});
      const query = definitions.adminAiRequestsExplorer as {
        query: (params: Record<string, unknown>) => unknown;
      };
      queryRequests.push(query.query({limit: 20, page: 1}) as Record<string, unknown>);
      return {
        useAdminAiRequestsExplorerQuery: () => ({
          data: {data: [], limit: 20, more: false, page: 1, total: 21},
          isLoading: false,
        }),
      };
    },
  };
  return api as unknown as AdminApi;
};

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};

describe("AIRequestsScreenWidget", () => {
  it("registers the AI explorer widget", () => {
    expect(AI_ADMIN_WIDGETS["ai-requests"]).toBe(AIRequestsScreenWidget);
  });

  it("injects the explorer endpoint and renders the first page", () => {
    queryRequests.length = 0;
    const {getByText} = renderWithTheme(
      <AIRequestsScreenWidget
        api={createAdminApi()}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-requests"
      />
    );

    expect(queryRequests).toEqual([
      {
        method: "GET",
        params: {limit: 20, page: 1},
        url: "/aiRequestsExplorer",
      },
    ]);
    expect(getByText("AI Request Explorer")).toBeDefined();
  });
});
