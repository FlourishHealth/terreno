import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {AreaChart} from "./AreaChart";
import {renderWithTheme} from "./test-utils";

const POINTS = [
  {label: "A", value: 0},
  {label: "B", value: 50},
  {label: "C", value: 100},
];

describe("AreaChart", () => {
  it("renders one mark testID per point", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <AreaChart data={POINTS} testID="chart" />
    );

    expect(getByTestId("chart.point.0-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.1-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.2-clickable")).toBeTruthy();
    expect(queryByTestId("chart.point.3-clickable")).toBeNull();
  });

  it("shows emptyText when data is empty", () => {
    const {getByText} = renderWithTheme(<AreaChart data={[]} emptyText="Nothing yet" />);

    expect(getByText("Nothing yet")).toBeTruthy();
  });

  it("shows tooltip copy after pressing a mark", async () => {
    const {getByTestId, getByText, queryByTestId} = renderWithTheme(
      <AreaChart data={POINTS} testID="chart" />
    );

    expect(queryByTestId("chart.tooltip")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.1-clickable"));
    });

    expect(getByTestId("chart.tooltip")).toBeTruthy();
    expect(getByText("B: 50")).toBeTruthy();
  });
});
