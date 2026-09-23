import {
  AreaChart,
  BarChart,
  Box,
  Card,
  DashboardGrid,
  DonutChart,
  Heading,
  LineChart,
  Text,
} from "@terreno/ui";
import type {FC, ReactElement} from "react";

import {
  CHART_VISUAL_FIXTURES,
  type ChartVisualFixtureId,
  type ChartVisualFixtureMeta,
  chartVisualFixtureTestId,
} from "./fixtureCatalog";

const WEEKDAY_POINTS = [
  {label: "Mon", value: 12},
  {label: "Tue", value: 18},
  {label: "Wed", value: 9},
];

const SIGNUP_POINTS = [
  {label: "Mon", value: 12},
  {label: "Tue", value: 18},
  {label: "Wed", value: 9},
  {label: "Thu", value: 22},
  {label: "Fri", value: 15},
];

const SIGNUP_WITH_GAPS = [
  {label: "Mon", value: -4},
  {label: "Tue", value: 0},
  {label: "Wed", value: 8},
  {label: "Thu", value: -2},
  {label: "Fri", value: 5},
];

const DONUT_POINTS = [
  {label: "Open", value: 12},
  {label: "In progress", value: 8},
  {label: "Done", value: 20},
];

const DONUT_HEX_POINTS = [
  {label: "Open", value: 12},
  {label: "In progress", value: 8},
  {color: "#543C00", label: "Done", value: 20},
];

const DENSE_POINTS = [
  {label: "Week of Aug 04", value: 4},
  {label: "Week of Aug 11", value: 9},
  {label: "Week of Aug 18", value: 6},
  {label: "Week of Aug 25", value: 14},
  {label: "Week of Sep 01", value: 11},
  {label: "Week of Sep 08", value: 18},
  {label: "Week of Sep 15", value: 7},
];

const formatUsd = (value: number): string => {
  return `$${value}`;
};

const FixtureFrame: FC<{fixture: ChartVisualFixtureMeta; children: ReactElement}> = ({
  children,
  fixture,
}) => {
  return (
    <Box color="base" padding={3} testID={chartVisualFixtureTestId(fixture.id)} width="100%">
      <Box marginBottom={2}>
        <Text bold size="sm">
          {fixture.difficulty}: {fixture.title}
        </Text>
      </Box>
      {children}
    </Box>
  );
};

const renderFixture = (fixture: (typeof CHART_VISUAL_FIXTURES)[number]): ReactElement => {
  switch (fixture.id) {
    case "line-three-points":
      return (
        <FixtureFrame fixture={fixture}>
          <LineChart data={WEEKDAY_POINTS} height={220} testID={fixture.id} />
        </FixtureFrame>
      );
    case "bar-three-points":
      return (
        <FixtureFrame fixture={fixture}>
          <BarChart data={WEEKDAY_POINTS} height={220} testID={fixture.id} />
        </FixtureFrame>
      );
    case "area-three-points":
      return (
        <FixtureFrame fixture={fixture}>
          <AreaChart data={WEEKDAY_POINTS} height={220} testID={fixture.id} />
        </FixtureFrame>
      );
    case "donut-three-slices":
      return (
        <FixtureFrame fixture={fixture}>
          <DonutChart data={DONUT_POINTS} height={220} testID={fixture.id} />
        </FixtureFrame>
      );
    case "line-empty":
      return (
        <FixtureFrame fixture={fixture}>
          <LineChart data={[]} emptyText="No signups yet" height={220} testID={fixture.id} />
        </FixtureFrame>
      );
    case "line-legend-currency":
      return (
        <FixtureFrame fixture={fixture}>
          <LineChart
            data={SIGNUP_POINTS}
            formatValue={formatUsd}
            height={240}
            legendLabel="Revenue"
            testID={fixture.id}
          />
        </FixtureFrame>
      );
    case "bar-negatives-and-zero":
      return (
        <FixtureFrame fixture={fixture}>
          <BarChart data={SIGNUP_WITH_GAPS} height={240} legendLabel="Delta" testID={fixture.id} />
        </FixtureFrame>
      );
    case "donut-hex-override":
      return (
        <FixtureFrame fixture={fixture}>
          <DonutChart data={DONUT_HEX_POINTS} height={240} testID={fixture.id} />
        </FixtureFrame>
      );
    case "line-dense-labels":
      return (
        <FixtureFrame fixture={fixture}>
          <LineChart
            data={DENSE_POINTS}
            height={240}
            legendLabel="Weekly active"
            testID={fixture.id}
          />
        </FixtureFrame>
      );
    case "line-fixed-slot-140":
      return (
        <FixtureFrame fixture={fixture}>
          <Box height={140} overflow="hidden" width="100%">
            <LineChart
              data={SIGNUP_POINTS}
              height={140}
              legendLabel="Signups"
              testID={fixture.id}
            />
          </Box>
        </FixtureFrame>
      );
    case "dashboard-mixed-cards":
      return (
        <FixtureFrame fixture={fixture}>
          <DashboardGrid columns={{lg: 2, md: 2, sm: 1}} gap={3} testID={fixture.id}>
            <Card>
              <LineChart data={SIGNUP_POINTS} height={180} legendLabel="Signups" />
            </Card>
            <Card>
              <BarChart data={SIGNUP_POINTS} height={180} legendLabel="Sessions" />
            </Card>
            <Card>
              <AreaChart data={SIGNUP_POINTS} height={180} legendLabel="Errors" />
            </Card>
            <Card>
              <DonutChart data={DONUT_HEX_POINTS} height={180} />
            </Card>
          </DashboardGrid>
        </FixtureFrame>
      );
    case "composed-product-card":
      return (
        <FixtureFrame fixture={fixture}>
          <Card>
            <Box gap={2} padding={2}>
              <Heading size="sm">North star</Heading>
              <Text color="secondaryDark" size="sm">
                Weekly signups with currency tooltips. Long axis labels must truncate in-band.
              </Text>
              <LineChart
                data={DENSE_POINTS}
                formatValue={formatUsd}
                height={220}
                legendLabel="Signups"
                testID={fixture.id}
              />
              <Text color="secondaryDark" size="sm">
                Caption: owned SVG, container width, height is the whole chart.
              </Text>
            </Box>
          </Card>
        </FixtureFrame>
      );
    case "ops-row-line-bar-donut":
      return (
        <FixtureFrame fixture={fixture}>
          <Box direction="column" gap={3} width="100%">
            <Heading size="sm">Ops</Heading>
            <Box direction="row" gap={3} width="100%" wrap>
              <Box flex="grow" minWidth={0} width="32%">
                <Card>
                  <LineChart data={SIGNUP_POINTS} height={200} legendLabel="Signups" />
                </Card>
              </Box>
              <Box flex="grow" minWidth={0} width="32%">
                <Card>
                  <BarChart data={SIGNUP_WITH_GAPS} height={200} legendLabel="Delta" />
                </Card>
              </Box>
              <Box flex="grow" minWidth={0} width="32%">
                <Card>
                  <DonutChart data={DONUT_POINTS} height={200} />
                </Card>
              </Box>
            </Box>
          </Box>
        </FixtureFrame>
      );
  }
};

export const renderChartVisualFixture = (id: ChartVisualFixtureId): ReactElement => {
  const fixture = CHART_VISUAL_FIXTURES.find((entry) => entry.id === id);
  if (!fixture) {
    throw new Error(`Unknown chart visual fixture: ${id}`);
  }
  return renderFixture(fixture);
};
