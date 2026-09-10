import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {LineChart} from "./LineChart";
import {renderWithTheme} from "./test-utils";

const POINTS = [
  {label: "A", value: 0},
  {label: "B", value: 50},
  {label: "C", value: 100},
];

describe("LineChart", () => {
  it("renders one mark testID per point", () => {
    const {getByTestId} = renderWithTheme(<LineChart data={POINTS} testID="chart" />);

    expect(getByTestId("chart.point.0-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.1-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.2-clickable")).toBeTruthy();
  });

  it("shows emptyText when data is empty", () => {
    const {getByText} = renderWithTheme(<LineChart data={[]} emptyText="Nothing yet" />);

    expect(getByText("Nothing yet")).toBeTruthy();
  });

  it("shows the default empty copy", () => {
    const {getByText} = renderWithTheme(<LineChart data={[]} />);

    expect(getByText("No data")).toBeTruthy();
  });

  it("shows a spinner when loading", async () => {
    const {getByTestId} = renderWithTheme(<LineChart data={POINTS} loading testID="chart" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(getByTestId("chart.spinner")).toBeTruthy();
  });

  it("shows tooltip copy after pressing a mark", async () => {
    const {getByTestId, getByText} = renderWithTheme(<LineChart data={POINTS} testID="chart" />);

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.1-clickable"));
    });

    expect(getByText("B: 50")).toBeTruthy();
  });

  it("renders the legend label", () => {
    const {getByText} = renderWithTheme(<LineChart data={POINTS} legendLabel="Sales" />);

    expect(getByText("Sales")).toBeTruthy();
  });
});
