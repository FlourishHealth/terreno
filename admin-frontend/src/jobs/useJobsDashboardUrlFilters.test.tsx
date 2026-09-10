import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import React from "react";
import {useJobsDashboardUrlFilters} from "../jobs/useJobsDashboardUrlFilters";

const replaceMock = mock((_href: unknown) => {});

mock.module("expo-router", () => ({
  router: {push: mock(() => {}), replace: replaceMock},
  useLocalSearchParams: () => ({page: "2", status: "dead"}),
}));

describe("useJobsDashboardUrlFilters", () => {
  it("parses URL params and writes filter changes to the jobs route", () => {
    const {result} = renderHook(() => useJobsDashboardUrlFilters("/admin"));
    expect(result.current.filters).toEqual({page: 2, status: "dead"});

    result.current.onFiltersChange({page: 1, q: "boom", scheduleId: "sched-1", status: "failed"});
    const href = String(replaceMock.mock.calls.at(-1)?.[0]);
    expect(href.startsWith("/admin/jobs?")).toBe(true);
    expect(href).toContain("q=boom");
    expect(href).toContain("status=failed");
    expect(href).toContain("scheduleId=sched-1");
  });

  it("uses an un-prefixed jobs route when routeBase is empty", () => {
    renderHook(() => useJobsDashboardUrlFilters(""));
    const {result} = renderHook(() => useJobsDashboardUrlFilters(""));
    result.current.onFiltersChange({page: 1});
    expect(String(replaceMock.mock.calls.at(-1)?.[0])).toBe("/jobs");
  });
});
