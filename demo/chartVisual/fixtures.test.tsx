import {describe, expect, it} from "bun:test";
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
});
