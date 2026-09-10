import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {BarChart} from "./BarChart";
import {renderWithTheme} from "./test-utils";

const POINTS = [
  {label: "A", value: 0},
  {label: "B", value: 50},
  {label: "C", value: 100},
];

describe("BarChart", () => {
  it("renders one mark testID per point", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(<BarChart data={POINTS} testID="chart" />);

    expect(getByTestId("chart.point.0-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.1-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.2-clickable")).toBeTruthy();
    expect(queryByTestId("chart.point.3-clickable")).toBeNull();
  });

  it("shows emptyText when data is empty", () => {
    const {getByText} = renderWithTheme(<BarChart data={[]} emptyText="Nothing yet" />);

    expect(getByText("Nothing yet")).toBeTruthy();
  });

  it("shows tooltip copy after pressing a mark", async () => {
    const {getByTestId, getByText, queryByTestId} = renderWithTheme(
      <BarChart data={POINTS} testID="chart" />
    );

    expect(queryByTestId("chart.tooltip")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.1-clickable"));
    });

    expect(getByTestId("chart.tooltip")).toBeTruthy();
    expect(getByText("B: 50")).toBeTruthy();
  });
});
