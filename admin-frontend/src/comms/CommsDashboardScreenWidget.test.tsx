import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../types";

const replaceMock = mock(() => {});
const searchParams: Record<string, string> = {channel: "mail"};

mock.module("expo-router", () => ({
  router: {push: mock(() => {}), replace: replaceMock},
  useLocalSearchParams: () => searchParams,
}));

/**
 * Stands in for the host RTK Query API so the real `useCommsDashboardApi` runs.
 * Mocking that module instead would leak process-wide and make the suite order-dependent.
 */
const createCommsApi = (): AdminApi => {
  const api = {
    enhanceEndpoints: () => api,
    injectEndpoints: () => ({
      useCommsDashboardDetailQuery: () => ({isLoading: false}),
      useCommsDashboardListQuery: () => ({
        data: {data: [], more: false, page: 1, total: 0},
        isLoading: false,
      }),
      useCommsDashboardRetryManyMutation: () => [
        () => ({unwrap: async () => ({retried: [], skipped: []})}),
        {isLoading: false},
      ],
      useCommsDashboardRetryMutation: () => [
        () => ({unwrap: async () => ({data: {_id: "x"}})}),
        {isLoading: false},
      ],
      useCommsDashboardStatsQuery: () => ({isLoading: false}),
    }),
  };
  return api as unknown as AdminApi;
};

import {COMMS_ADMIN_WIDGETS, CommsDashboardScreenWidget} from "./CommsDashboardScreenWidget";

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};

describe("CommsDashboardScreenWidget", () => {
  it("registers as the comms custom screen widget", () => {
    expect(COMMS_ADMIN_WIDGETS.comms).toBe(CommsDashboardScreenWidget);
  });

  it("reads URL filters into the dashboard", () => {
    const {getByTestId} = renderWithTheme(
      <CommsDashboardScreenWidget
        api={createCommsApi()}
        config={emptyConfig}
        routeBase="/admin"
        screenName="comms"
      />
    );
    expect(getByTestId("comms-dashboard")).toBeTruthy();
    expect(getByTestId("comms-filter-channel.label")).toBeTruthy();
  });
});
