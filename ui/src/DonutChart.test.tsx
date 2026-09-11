import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {DonutChart} from "./DonutChart";
import {renderWithTheme} from "./test-utils";

const POINTS = [
  {label: "A", value: 50},
  {color: "#112233", label: "B", value: 50},
];

describe("DonutChart", () => {
  it("renders one mark testID per slice", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <DonutChart data={POINTS} testID="chart" />
    );

    expect(getByTestId("chart.point.0-clickable")).toBeTruthy();
    expect(getByTestId("chart.point.1-clickable")).toBeTruthy();
    expect(queryByTestId("chart.point.2-clickable")).toBeNull();
  });

  it("applies a per-slice color override on the legend swatch", () => {
    const {getByTestId} = renderWithTheme(<DonutChart data={POINTS} testID="chart" />);
    const swatchStyle = getByTestId("chart.swatch.1").props.style;
    const styles = Array.isArray(swatchStyle) ? swatchStyle : [swatchStyle];

    expect(styles).toEqual(
      expect.arrayContaining([expect.objectContaining({backgroundColor: "#112233"})])
    );
  });

  it("shows emptyText when data is empty", () => {
    const {getByText} = renderWithTheme(<DonutChart data={[]} emptyText="Nothing yet" />);

    expect(getByText("Nothing yet")).toBeTruthy();
  });

  it("renders a legend row per slice and ignores legendLabel", () => {
    const {getByText, queryByText} = renderWithTheme(
      <DonutChart data={POINTS} legendLabel="Should hide" />
    );

    expect(getByText("A")).toBeTruthy();
    expect(getByText("B")).toBeTruthy();
    expect(queryByText("Should hide")).toBeNull();
  });

  it("places the first equal slice hit on the right of center (painted 12–6 o'clock)", () => {
    const {getByTestId} = renderWithTheme(<DonutChart data={POINTS} height={220} testID="chart" />);
    const markStyle = getByTestId("chart.point.0-clickable").props.style;
    const styles = Array.isArray(markStyle) ? markStyle : [markStyle];
    const positioned = styles.find(
      (entry: {left?: number; top?: number} | undefined) =>
        typeof entry?.left === "number" && typeof entry?.top === "number"
    ) as {left: number; top: number};

    expect(positioned.left).toBeGreaterThan(110);
    expect(positioned.top).toBeCloseTo(98, 0);
  });

  it("shows tooltip copy after pressing a slice mark", async () => {
    const {getByTestId, getByText} = renderWithTheme(<DonutChart data={POINTS} testID="chart" />);

    await act(async () => {
      fireEvent.press(getByTestId("chart.point.1-clickable"));
    });

    expect(getByText("B: 50")).toBeTruthy();
  });
});
