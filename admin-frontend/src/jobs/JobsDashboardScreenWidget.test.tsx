import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../types";

const replaceMock = mock(() => {});
const searchParams: Record<string, string> = {status: "dead"};

mock.module("expo-router", () => ({
  router: {push: mock(() => {}), replace: replaceMock},
  useLocalSearchParams: () => searchParams,
}));

const createJobsApi = (): AdminApi => {
  const api = {
    enhanceEndpoints: () => api,
    injectEndpoints: () => ({
      useJobsDashboardCancelMutation: () => [
        () => ({unwrap: async () => ({})}),
        {isLoading: false},
      ],
      useJobsDashboardDetailQuery: () => ({isLoading: false}),
      useJobsDashboardListQuery: () => ({
        data: {data: [], more: false, page: 1, total: 0},
        isLoading: false,
      }),
      useJobsDashboardPauseScheduleMutation: () => [
        () => ({unwrap: async () => ({})}),
        {isLoading: false},
      ],
      useJobsDashboardRequeueMutation: () => [
        () => ({unwrap: async () => ({})}),
        {isLoading: false},
      ],
      useJobsDashboardResumeScheduleMutation: () => [
        () => ({unwrap: async () => ({})}),
        {isLoading: false},
      ],
      useJobsDashboardRetryMutation: () => [() => ({unwrap: async () => ({})}), {isLoading: false}],
      useJobsDashboardSchedulesQuery: () => ({data: [], isLoading: false}),
      useJobsDashboardStatsQuery: () => ({
        data: {byStatus: {}, total: 0},
        isLoading: false,
      }),
    }),
  };
  return api as unknown as AdminApi;
};

import {JOBS_ADMIN_WIDGETS, JobsDashboardScreenWidget} from "./JobsDashboardScreenWidget";

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};

describe("JobsDashboardScreenWidget", () => {
  it("registers as the jobs custom screen widget", () => {
    expect(JOBS_ADMIN_WIDGETS.jobs).toBe(JobsDashboardScreenWidget);
  });

  it("reads URL filters into the dashboard", () => {
    const {getByTestId} = renderWithTheme(
      <JobsDashboardScreenWidget
        api={createJobsApi()}
        config={emptyConfig}
        routeBase="/admin"
        screenName="jobs"
      />
    );
    expect(getByTestId("jobs-dashboard")).toBeTruthy();
    expect(getByTestId("jobs-filter-status.label")).toBeTruthy();
  });

  it("uses an un-prefixed jobs route when routeBase is empty", () => {
    const {getByTestId} = renderWithTheme(
      <JobsDashboardScreenWidget
        api={createJobsApi()}
        config={emptyConfig}
        routeBase=""
        screenName="jobs"
      />
    );
    expect(getByTestId("jobs-dashboard")).toBeTruthy();
  });
});
