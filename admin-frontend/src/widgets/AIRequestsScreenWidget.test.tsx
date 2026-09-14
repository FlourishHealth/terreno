// noExplicitAny: test mocks use type-erased RTK Query API doubles
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import * as TerrenoUI from "@terreno/ui";
import {act} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import type {AdminApi} from "../types";

let explorerQueryArg: Record<string, unknown> | undefined;
let explorerProps: Record<string, unknown> | undefined;
let explorerData: {data: unknown[]; total: number} | undefined;
let explorerLoading = false;

const ExplorerStub: React.FC<Record<string, unknown>> = (props) => {
  explorerProps = props;
  return (
    <TerrenoUI.Box testID={props.testID as string}>
      <TerrenoUI.Text>{`${props.totalCount} total requests`}</TerrenoUI.Text>
      {props.isLoading ? <TerrenoUI.Spinner /> : null}
    </TerrenoUI.Box>
  );
};

mock.module("../AdminScreenPage", () => ({
  AdminScreenPage: ({children}: {children: React.ReactNode}) => children,
}));

mock.module("@terreno/ui", () => ({
  ...TerrenoUI,
  AIRequestExplorer: ExplorerStub,
}));

import {AIRequestsScreenWidget} from "./AIRequestsScreenWidget";

const makeExplorerApi = (): AdminApi =>
  ({
    injectEndpoints: () => ({
      useAdminAiRequestsExplorerQuery: (arg: Record<string, unknown>) => {
        explorerQueryArg = arg;
        return {data: explorerData, isLoading: explorerLoading};
      },
    }),
  }) as unknown as AdminApi;

describe("AIRequestsScreenWidget", () => {
  beforeEach(() => {
    explorerQueryArg = undefined;
    explorerProps = undefined;
    explorerData = {data: [{id: "req-1"}], total: 21};
    explorerLoading = false;
  });

  it("requests explorer data with the current page and filters", () => {
    const {getByText} = renderWithTheme(
      <AIRequestsScreenWidget api={makeExplorerApi()} routeBase="/admin" />
    );

    expect(getByText("21 total requests")).toBeTruthy();
    assert.deepEqual(explorerQueryArg, {
      endDate: undefined,
      limit: 20,
      page: 1,
      requestType: undefined,
      startDate: undefined,
    });
    assert.equal(explorerProps?.page, 1);
    assert.equal(explorerProps?.totalCount, 21);
  });

  it("resets page to 1 when filters change and forwards updated query args", async () => {
    renderWithTheme(<AIRequestsScreenWidget api={makeExplorerApi()} routeBase="/admin" />);
    assert.isDefined(explorerProps);

    await act(async () => {
      (explorerProps?.onRequestTypeFilterChange as (types: string[]) => void)?.(["json_object"]);
      (explorerProps?.onStartDateChange as (value: string) => void)?.("2024-01-01");
      (explorerProps?.onEndDateChange as (value: string) => void)?.("2024-01-31");
    });

    assert.equal(explorerQueryArg?.page, 1);
    assert.equal(explorerQueryArg?.requestType, "json_object");
    assert.equal(explorerQueryArg?.startDate, "2024-01-01");
    assert.equal(explorerQueryArg?.endDate, "2024-01-31");

    await act(async () => {
      (explorerProps?.onPageChange as (page: number) => void)?.(2);
    });
    assert.equal(explorerQueryArg?.page, 2);
    assert.equal(explorerProps?.page, 2);
  });

  it("shows loading state and computes total pages from the response", () => {
    explorerLoading = true;
    explorerData = {data: [], total: 45};
    const {getByText} = renderWithTheme(
      <AIRequestsScreenWidget api={makeExplorerApi()} routeBase="/admin" />
    );

    assert.isTrue(explorerProps?.isLoading);
    assert.equal(explorerProps?.totalPages, 3);
    assert.equal(explorerProps?.totalCount, 45);
    expect(getByText("45 total requests")).toBeTruthy();
  });
});
