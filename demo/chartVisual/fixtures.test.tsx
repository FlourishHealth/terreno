import {describe, expect, it} from "bun:test";
import {assert} from "chai";
import type React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import ChartVisualGalleryPage from "../app/demo/chart-visual-gallery";

import {ChartVisualGallery} from "./ChartVisualGallery";
import type {ChartVisualFixtureId} from "./fixtureCatalog";
import {CHART_VISUAL_FIXTURES, CHART_VISUAL_GALLERY_TEST_ID} from "./fixtureCatalog";
import {renderChartVisualFixture} from "./fixtures";

const Host: React.FC<{id: ChartVisualFixtureId}> = ({id}) => {
  return renderChartVisualFixture(id);
};

describe("chart visual fixtures", () => {
  it("renders the full visual gallery", () => {
    const {getByTestId} = renderWithTheme(<ChartVisualGallery />);

    expect(getByTestId(CHART_VISUAL_GALLERY_TEST_ID)).toBeTruthy();
  });

  it("renders the Expo Router gallery page", () => {
    const {getByTestId} = renderWithTheme(<ChartVisualGalleryPage />);

    expect(getByTestId(CHART_VISUAL_GALLERY_TEST_ID)).toBeTruthy();
  });

  for (const fixture of CHART_VISUAL_FIXTURES) {
    it(`renders ${fixture.id} without throwing`, () => {
      expect(() => {
        renderWithTheme(<Host id={fixture.id} />);
      }).not.toThrow();
    });
  }

  it("renders five current/comparison scorecard pairs", async (): Promise<void> => {
    const {findByTestId} = renderWithTheme(<Host id="scorecard-sparkline-comparison" />);

    for (let index = 0; index < 5; index += 1) {
      assert.exists(await findByTestId(`scorecard-fixture.${index}.sparkline.current`));
      assert.exists(await findByTestId(`scorecard-fixture.${index}.sparkline.comparison`));
    }
  });

  it("binds cartesian parity fixture ids to their intended paint behavior", async (): Promise<void> => {
    const timeBars = renderWithTheme(<Host id="bar-time-rotated-ticks" />);
    const timeTickStyle = (await timeBars.findByTestId("bar-time-rotated-ticks.xtick.0")).props
      .style;
    const timeTickStyles = Array.isArray(timeTickStyle) ? timeTickStyle : [timeTickStyle];
    assert.isTrue(timeTickStyles.some((style) => Array.isArray(style?.transform)));

    const weekdayBars = renderWithTheme(<Host id="bar-day-of-week" />);
    const weekdayTickStyle = (await weekdayBars.findByTestId("bar-day-of-week.xtick.0")).props
      .style;
    const weekdayTickStyles = Array.isArray(weekdayTickStyle)
      ? weekdayTickStyle
      : [weekdayTickStyle];
    assert.isFalse(weekdayTickStyles.some((style) => Array.isArray(style?.transform)));

    const threeLines = renderWithTheme(<Host id="line-three-series" />);
    for (let index = 0; index < 3; index += 1) {
      assert.exists(await threeLines.findByTestId(`line-three-series.series.${index}.path`));
      assert.exists(await threeLines.findByTestId(`line-three-series.legend.${index}`));
    }
  });
});
