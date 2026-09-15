import {describe, expect, it} from "bun:test";
import type React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";

import type {ChartVisualFixtureId} from "./fixtureCatalog";
import {CHART_VISUAL_FIXTURES} from "./fixtureCatalog";
import {renderChartVisualFixture} from "./fixtures";

const Host: React.FC<{id: ChartVisualFixtureId}> = ({id}) => {
  return renderChartVisualFixture(id);
};

describe("chart visual fixtures", () => {
  for (const fixture of CHART_VISUAL_FIXTURES) {
    it(`renders ${fixture.id} without throwing`, () => {
      expect(() => {
        renderWithTheme(<Host id={fixture.id} />);
      }).not.toThrow();
    });
  }
});
