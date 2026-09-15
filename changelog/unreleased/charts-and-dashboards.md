---
category: Added
---

`@terreno/ui` now ships owned-SVG `LineChart`, `BarChart`, `AreaChart`, and `DonutChart`
plus an eager `DashboardGrid` for wrapping caller `Card`s. Charts use `react-native-svg`
and private d3 helpers — not `victory-native`. Each chart sizes itself to its container
and clips to it, so a chart never widens the card it sits in, and `height` covers the whole
chart including its tick and tooltip rows. `bun run ui:charts:compare` diffs actually
rendered gallery PNGs against `demo/rendered-snapshots/` (not JSON snapshots).
