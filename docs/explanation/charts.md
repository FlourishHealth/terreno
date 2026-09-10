# Why Terreno owns chart SVG

Terreno charts are drawn with `react-native-svg` and private `d3-scale` / `d3-shape` helpers inside `@terreno/ui`. Apps import `LineChart`, `BarChart`, `AreaChart`, and `DonutChart` — not d3 types and not a third-party chart API.

`victory-native` was rejected for this slice: Skia canvas fights Terreno theme fonts, bun tests, and accessibility. Owned SVG lets axis labels stay `@terreno/ui` `Text` (Nunito/Titillium) and lets hit targets stay clickable `Box`es with `testID`s.

`BarChart` grows each bar from the zero baseline (up for positives, down for negatives). A zero value draws no sliver; the press/hover hit stays at least 24px so the tooltip still works.

`DashboardGrid` is layout only, so it stays on the eager root export. Chart implementations sit behind the same lazy root boundary as `GPTChat`. Cell width subtracts flex `gap` so `md`/`lg` column counts actually fit.
