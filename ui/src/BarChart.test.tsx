import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";

import {BarChart} from "./BarChart";
import {renderWithTheme} from "./test-utils";

const POINTS = [
  {label: "A", value: 0},
  {label: "B", value: 50},
  {label: "C", value: 100},
];

const DATE_POINTS = Array.from({length: 14}, (_, index) => ({
  label: `Sep ${index + 1}, 2026`,
  value: index + 1,
}));

const WEEKDAY_POINTS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
].map((label, index) => ({label, value: index + 1}));

describe("BarChart", () => {
  it("rotates dense time labels in auto mode and keeps seven categories horizontal", () => {
    const dense = renderWithTheme(<BarChart data={DATE_POINTS} testID="dense-chart" />);
    const denseStyle = dense.getByTestId("dense-chart.xtick.0").props.style;
    const denseStyles = Array.isArray(denseStyle) ? denseStyle : [denseStyle];
    assert.isTrue(denseStyles.some((style) => Array.isArray(style?.transform)));

    const categorical = renderWithTheme(<BarChart data={WEEKDAY_POINTS} testID="weekday-chart" />);
    const categoryStyle = categorical.getByTestId("weekday-chart.xtick.0").props.style;
    const categoryStyles = Array.isArray(categoryStyle) ? categoryStyle : [categoryStyle];
    assert.isFalse(categoryStyles.some((style) => Array.isArray(style?.transform)));
  });

  it("draws lighter comparison bars on the shared scale", () => {
    const comparisonData = POINTS.map((point) => ({...point, value: point.value + 10}));
    const {getByTestId} = renderWithTheme(
      <BarChart comparisonData={comparisonData} data={POINTS} testID="chart" />
    );

    assert.exists(getByTestId("chart.comparison.1"));
    assert.isBelow(getByTestId("chart.comparison.1").props.opacity, 1);
  });

  it("renders chart-card header shortcuts and invokes the period action", async (): Promise<void> => {
    let pressCount = 0;
    const handlePeriodPress = (): void => {
      pressCount += 1;
    };
    const {getByTestId, getByText} = renderWithTheme(
      <BarChart
        data={POINTS}
        onPeriodPress={handlePeriodPress}
        periodLabel="Last 14 days"
        testID="chart"
        title="Cost / conv. over time"
      />
    );

    assert.exists(getByText("Cost / conv. over time"));
    fireEvent.press(getByTestId("chart.card.period-clickable"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(pressCount, 1);
  });

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

  it("updates or clears the active tooltip when data changes", async () => {
    const {getByTestId, getByText, queryByTestId, rerender} = renderWithTheme(
      <BarChart data={POINTS} testID="chart" />
    );

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.1-clickable"));
    });
    rerender(
      <BarChart
        data={[
          {label: "A", value: 0},
          {label: "B", value: 75},
        ]}
        testID="chart"
      />
    );
    expect(getByText("B: 75")).toBeTruthy();

    rerender(<BarChart data={[{label: "A", value: 0}]} testID="chart" />);
    expect(queryByTestId("chart.tooltip")).toBeNull();
  });

  it("shows tooltip copy after pressing a zero-value bar", async () => {
    const {getByTestId, getByText} = renderWithTheme(<BarChart data={POINTS} testID="chart" />);

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.0-clickable"));
    });

    expect(getByTestId("chart.tooltip")).toBeTruthy();
    expect(getByText("A: 0")).toBeTruthy();
  });

  it("shows tooltip copy after pressing a negative-value bar", async () => {
    const {getByTestId, getByText} = renderWithTheme(
      <BarChart
        data={[
          {label: "Loss", value: -20},
          {label: "Gain", value: 10},
        ]}
        testID="chart"
      />
    );

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.0-clickable"));
    });

    expect(getByTestId("chart.tooltip")).toBeTruthy();
    expect(getByText("Loss: -20")).toBeTruthy();
  });
});
