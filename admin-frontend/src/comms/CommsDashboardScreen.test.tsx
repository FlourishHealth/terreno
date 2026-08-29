// biome-ignore-all lint/suspicious/noExplicitAny: test harness doubles
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import type {AdminApi} from "../types";

const pushMock = mock(() => {});
mock.module("expo-router", () => ({
  router: {push: pushMock, replace: mock(() => {})},
  useLocalSearchParams: () => ({}),
}));

interface ListState {
  data?: {
    data: unknown[];
    more: boolean;
    page: number;
    total: number;
  };
  error?: unknown;
  isLoading: boolean;
}

const listState: ListState = {isLoading: false};
const statsState: {data?: unknown} = {};
const retryImpl = mock(async () => ({data: {_id: "retry-1"}}));
const retryManyImpl = mock(async () => ({retried: [{_id: "n1"}], skipped: []}));

mock.module("./useCommsDashboardApi", () => ({
  useCommsDashboardApi: () => ({
    useListQuery: () => listState,
    useRetryManyMutation: () => [() => ({unwrap: retryManyImpl}), {isLoading: false}],
    useRetryMutation: () => [() => ({unwrap: retryImpl}), {isLoading: false}],
    useStatsQuery: () => statsState,
  }),
}));

import {CommsDashboardScreen} from "./CommsDashboardScreen";

describe("CommsDashboardScreen", () => {
  beforeEach(() => {
    listState.data = undefined;
    listState.error = undefined;
    listState.isLoading = false;
    statsState.data = {
      byProvider: [],
      totals: {
        bounced: 0,
        cancelled: 0,
        delivered: 0,
        failed: 0,
        failureRate: 0,
        sent: 0,
        total: 0,
      },
    };
    pushMock.mockClear();
    retryImpl.mockClear();
    retryManyImpl.mockClear();
  });

  it("renders the loading state", () => {
    listState.isLoading = true;
    const {getByTestId} = renderWithTheme(
      <CommsDashboardScreen api={{} as AdminApi} filters={{}} onFiltersChange={() => undefined} />
    );
    expect(getByTestId("comms-dashboard-loading")).toBeTruthy();
  });

  it("renders the error state", () => {
    listState.error = {status: 500};
    const {getByTestId} = renderWithTheme(
      <CommsDashboardScreen api={{} as AdminApi} filters={{}} onFiltersChange={() => undefined} />
    );
    expect(getByTestId("comms-dashboard-error")).toBeTruthy();
  });

  it("renders the empty state", () => {
    listState.data = {data: [], more: false, page: 1, total: 0};
    const {getByTestId} = renderWithTheme(
      <CommsDashboardScreen api={{} as AdminApi} filters={{}} onFiltersChange={() => undefined} />
    );
    expect(getByTestId("comms-dashboard-empty")).toBeTruthy();
  });

  it("writes filter changes through onFiltersChange for URL persistence", () => {
    listState.data = {data: [], more: false, page: 1, total: 0};
    const onFiltersChange = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <CommsDashboardScreen
        api={{} as AdminApi}
        filters={{channel: "mail", page: 2}}
        onFiltersChange={onFiltersChange}
      />
    );
    fireEvent.changeText(getByTestId("comms-filter-q"), "timeout");
    expect(onFiltersChange).toHaveBeenCalled();
    const next = (onFiltersChange.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(next.q).toBe("timeout");
    expect(next.channel).toBe("mail");
    expect(next.page).toBe(1);
  });

  it("disables inline retry and exposes the reason", () => {
    listState.data = {
      data: [
        {
          _id: "m1",
          channel: "mail",
          created: "2026-08-20T00:00:00.000Z",
          provider: "sendgrid",
          retryable: false,
          retryDisabledReason: "Permanent failures cannot be retried",
          status: "failed",
          subject: "Hi",
          to: "a***@example.com",
        },
      ],
      more: false,
      page: 1,
      total: 1,
    };
    const {getByTestId} = renderWithTheme(
      <CommsDashboardScreen api={{} as AdminApi} filters={{}} onFiltersChange={() => undefined} />
    );
    const retryButton = getByTestId("comms-row-retry");
    expect(retryButton.props["aria-label"]).toBe("Permanent failures cannot be retried");
  });

  it("shows the exact matching count in the bulk retry confirmation", async () => {
    listState.data = {
      data: [
        {
          _id: "m1",
          channel: "mail",
          created: "2026-08-20T00:00:00.000Z",
          provider: "sendgrid",
          retryable: true,
          status: "failed",
          to: "a***@example.com",
        },
      ],
      more: true,
      page: 1,
      total: 42,
    };
    const {getByTestId, getByText} = renderWithTheme(
      <CommsDashboardScreen
        api={{} as AdminApi}
        filters={{status: "failed"}}
        onFiltersChange={() => undefined}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("comms-retry-many"));
    });
    expect(getByText("Retry 42 matching messages (cap 100)?")).toBeTruthy();
  });
});
