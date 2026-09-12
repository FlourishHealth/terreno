import {describe, expect, it, spyOn} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {Linking} from "react-native";

import {LineChart} from "./LineChart";
import {renderWithTheme} from "./test-utils";

const POINTS = [
  {label: "A", value: 0},
  {label: "B", value: 50},
  {label: "C", value: 100},
];

describe("LineChart", () => {
  it("renders one mark testID per point", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <LineChart data={POINTS} testID="chart" />
    );

    expect(getByTestId("chart.point.0-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.1-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.2-clickable")).toBeTruthy();
    expect(queryByTestId("chart.point.3-clickable")).toBeNull();
  });

  it("shows emptyText when data is empty", () => {
    const {getByText, queryByText} = renderWithTheme(
      <LineChart data={[]} emptyText="Nothing yet" />
    );

    expect(getByText("Nothing yet")).toBeTruthy();
    expect(queryByText("Line chart")).toBeNull();
  });

  it("shows the default empty copy", () => {
    const {getByText} = renderWithTheme(<LineChart data={[]} />);

    expect(getByText("No data")).toBeTruthy();
  });

  it("shows a spinner when loading and hides marks", async () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <LineChart data={POINTS} loading testID="chart" />
    );

    expect(queryByTestId("chart.point.0-clickable")).toBeNull();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(getByTestId("chart.spinner")).toBeTruthy();
    expect(queryByTestId("chart.point.0-clickable")).toBeNull();
  });

  it("prefers loading over empty copy", async () => {
    const {queryByText, getByTestId} = renderWithTheme(
      <LineChart data={[]} emptyText="Nothing yet" loading testID="chart" />
    );

    expect(queryByText("Nothing yet")).toBeNull();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(getByTestId("chart.spinner")).toBeTruthy();
    expect(queryByText("Nothing yet")).toBeNull();
  });

  it("shows tooltip copy after pressing a mark", async () => {
    const {getByTestId, getByText, queryByTestId} = renderWithTheme(
      <LineChart data={POINTS} testID="chart" />
    );

    expect(queryByTestId("chart.tooltip")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.1-clickable"));
    });

    expect(getByTestId("chart.tooltip")).toBeTruthy();
    expect(getByText("B: 50")).toBeTruthy();
  });

  it("renders the legend label", () => {
    const {getByText} = renderWithTheme(<LineChart data={POINTS} legendLabel="Sales" />);

    expect(getByText("Sales")).toBeTruthy();
  });

  it("does not open URLs from x-axis labels", async () => {
    const openURLSpy = spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve(true));
    const {getByText} = renderWithTheme(
      <LineChart data={[{label: "https://evil.example", value: 10}]} />
    );

    await act(async () => {
      fireEvent.press(getByText("https://evil.example"));
    });

    expect(openURLSpy).not.toHaveBeenCalled();
    openURLSpy.mockRestore();
  });
});
