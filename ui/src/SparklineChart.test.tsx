import {describe, it} from "bun:test";
import {assert} from "chai";

import {SparklineChart} from "./SparklineChart";
import {renderWithTheme} from "./test-utils";

const CURRENT = [
  {label: "Mon", value: 12},
  {label: "Tue", value: 18},
  {label: "Wed", value: 9},
];

const COMPARISON = [
  {label: "Mon", value: 10},
  {label: "Tue", value: 11},
  {label: "Wed", value: 15},
];

describe("SparklineChart", () => {
  it("renders current and dotted comparison paths without chart chrome", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <SparklineChart comparisonData={COMPARISON} data={CURRENT} testID="revenue-sparkline" />
    );

    assert.exists(getByTestId("revenue-sparkline.current"));
    assert.equal(getByTestId("revenue-sparkline.comparison").props.strokeDasharray, "4 4");
    assert.notExists(queryByTestId("revenue-sparkline.tooltip"));
    assert.notExists(queryByTestId("revenue-sparkline.legend"));
  });

  it("renders an empty frame without throwing", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <SparklineChart data={[]} testID="empty-sparkline" />
    );

    assert.exists(getByTestId("empty-sparkline"));
    assert.notExists(queryByTestId("empty-sparkline.current"));
  });
});
