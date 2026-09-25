import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";

import {AreaChart} from "./AreaChart";
import {renderWithTheme} from "./test-utils";

const POINTS = [
  {label: "A", value: 0},
  {label: "B", value: 50},
  {label: "C", value: 100},
];

describe("AreaChart", () => {
  it("renders an area, line, and legend for each named series", () => {
    const series = [
      {data: POINTS, id: "current", label: "Current"},
      {
        data: POINTS.map((point) => ({...point, value: point.value / 2})),
        id: "previous",
        label: "Previous",
      },
    ];
    const {getByTestId, getByText} = renderWithTheme(
      <AreaChart data={[]} series={series} testID="chart" />
    );

    for (let index = 0; index < series.length; index += 1) {
      assert.exists(getByTestId(`chart.series.${index}.area`));
      assert.exists(getByTestId(`chart.series.${index}.path`));
      assert.exists(getByTestId(`chart.series.${index}.marker.0`));
      assert.exists(getByText(series[index]?.label ?? ""));
    }
  });

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

  it("updates or clears the active tooltip when data changes", async () => {
    const {getByTestId, getByText, queryByTestId, rerender} = renderWithTheme(
      <AreaChart data={POINTS} testID="chart" />
    );

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.1-clickable"));
    });
    rerender(
      <AreaChart
        data={[
          {label: "A", value: 0},
          {label: "B", value: 75},
        ]}
        testID="chart"
      />
    );
    expect(getByText("B: 75")).toBeTruthy();

    rerender(<AreaChart data={[{label: "A", value: 0}]} testID="chart" />);
    expect(queryByTestId("chart.tooltip")).toBeNull();
  });
});
