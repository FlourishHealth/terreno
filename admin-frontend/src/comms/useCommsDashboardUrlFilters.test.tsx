import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";

const replaceMock = mock((_href: string) => {});
let searchParams: Record<string, unknown> = {};

mock.module("expo-router", () => ({
  router: {push: mock(() => {}), replace: replaceMock},
  useLocalSearchParams: () => searchParams,
}));

import {useCommsDashboardUrlFilters} from "./useCommsDashboardUrlFilters";

const lastHref = (): string => String(replaceMock.mock.calls.at(-1)?.[0] ?? "");

describe("useCommsDashboardUrlFilters", () => {
  beforeEach(() => {
    searchParams = {};
    replaceMock.mockClear();
  });

  it("parses the current query into filters", () => {
    searchParams = {channel: "mail", page: "2", q: "timeout"};
    const {result} = renderHook(() => useCommsDashboardUrlFilters("/admin"));
    expect(result.current.filters).toEqual({
      channel: "mail",
      endDate: undefined,
      errorClass: undefined,
      page: 2,
      provider: undefined,
      q: "timeout",
      startDate: undefined,
      status: undefined,
    });
  });

  it("writes filters back onto the route as a query string", () => {
    const {result} = renderHook(() => useCommsDashboardUrlFilters("/admin"));
    result.current.onFiltersChange({channel: "sms", page: 3, status: "failed"});
    const href = lastHref();
    expect(href.startsWith("/admin/comms?")).toBe(true);
    expect(href).toContain("channel=sms");
    expect(href).toContain("status=failed");
    expect(href).toContain("page=3");
  });

  it("drops the query entirely when no filters remain", () => {
    const {result} = renderHook(() => useCommsDashboardUrlFilters("/admin"));
    result.current.onFiltersChange({page: 1});
    expect(lastHref()).toBe("/admin/comms");
  });

  it("defaults to a root-relative route when the host has no route base", () => {
    const {result} = renderHook(() => useCommsDashboardUrlFilters());
    result.current.onFiltersChange({});
    expect(lastHref()).toBe("/comms");
  });
});
