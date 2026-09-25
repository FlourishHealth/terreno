import {describe, it} from "bun:test";
import {assert} from "chai";
import {Scorecard} from "./Scorecard";
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

describe("Scorecard", () => {
  it("renders a formatted metric with current and comparison sparkline paths", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <Scorecard
        comparisonData={COMPARISON}
        formatValue={(value): string => `$${value}`}
        sparklineData={CURRENT}
        testID="cost-scorecard"
        title="Cost"
        value={569}
      />
    );

    assert.exists(getByText("Cost"));
    assert.exists(getByText("$569"));
    assert.exists(getByTestId("cost-scorecard.sparkline.current"));
    assert.exists(getByTestId("cost-scorecard.sparkline.comparison"));
  });

  it("renders a string metric without requiring sparkline data", () => {
    const {getByText, queryByTestId} = renderWithTheme(
      <Scorecard testID="status-scorecard" title="Status" value="Healthy" />
    );

    assert.exists(getByText("Healthy"));
    assert.notExists(queryByTestId("status-scorecard.sparkline"));
  });
});
