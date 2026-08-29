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

mock.module("./useCommsDashboardApi", () => ({
  useCommsDashboardApi: () => ({
    useListQuery: () => ({
      data: {data: [], more: false, page: 1, total: 0},
      isLoading: false,
    }),
    useRetryManyMutation: () => [() => ({unwrap: async () => ({retried: [], skipped: []})}), {}],
    useRetryMutation: () => [() => ({unwrap: async () => ({data: {_id: "x"}})}), {}],
    useStatsQuery: () => ({data: undefined}),
  }),
}));

import {COMMS_ADMIN_WIDGETS, CommsDashboardScreenWidget} from "./CommsDashboardScreenWidget";

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};

describe("CommsDashboardScreenWidget", () => {
  it("registers as the comms custom screen widget", () => {
    expect(COMMS_ADMIN_WIDGETS.comms).toBe(CommsDashboardScreenWidget);
  });

  it("reads URL filters into the dashboard", () => {
    const {getByTestId} = renderWithTheme(
      <CommsDashboardScreenWidget
        api={{} as AdminApi}
        config={emptyConfig}
        routeBase="/admin"
        screenName="comms"
      />
    );
    expect(getByTestId("comms-dashboard")).toBeTruthy();
    expect(getByTestId("comms-filter-channel.label")).toBeTruthy();
  });
});
