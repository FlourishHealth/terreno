# Compose charts in a dashboard grid

Put each chart in a `Card`, then wrap the cards in `DashboardGrid`.

```tsx
import type {FC} from "react";
import {BarChart, Card, DashboardGrid, LineChart} from "@terreno/ui";

const POINTS = [
  {label: "Mon", value: 3},
  {label: "Tue", value: 5},
];

export const OpsDashboard: FC = () => {
  return (
    <DashboardGrid>
      <Card>
        <LineChart data={POINTS} legendLabel="Signups" />
      </Card>
      <Card>
        <BarChart data={POINTS} legendLabel="Sessions" />
      </Card>
    </DashboardGrid>
  );
};
```

1. Pass a single series of `{label, value}` points.
2. Use `emptyText` and `loading` on the chart, not a custom overlay.
3. Press or hover a mark for `{label}: {value}`. Zero and negative bars stay pressable; bars grow from the zero baseline.
4. Keep `DashboardGrid` eager; import charts from `@terreno/ui/LineChart` when cold start matters.

`DonutChart` ignores `legendLabel` and draws one legend row per slice. Override a slice with `color` on that point.
