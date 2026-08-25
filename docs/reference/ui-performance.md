# UI performance benchmarks

Run the benchmark that covers the component being changed:

```bash
cd ui
bun run performance:p0
bun run performance:p1
bun run performance:p2:responsive-box
```

The benchmarks render large trees through the same React Native test environment as the UI
component suite. They report median wall-clock times after two warmups and seven measured samples:

- 500 `Box`, `Text`, and `Heading` instances
- 100 `MarkdownView` instances
- 500 theme consumers
- a 100-row, eight-column `DataTable` with two pinned columns
- 500 `Icon` instances
- 500 responsive `Box` instances with `sm`, `md`, and `lg` direction props
- initial mount, same-prop update, and changed-prop/theme update timings

Use it for before/after comparisons on the same machine. It is not a device frame-rate benchmark;
native and browser profiling remain necessary for user-visible regressions.

## August 2026 P0 optimization results

All measurements below came from the same Cursor Cloud VM using Bun 1.3.11 and the default benchmark
settings. Times are milliseconds; lower is better.

| Step | Box same | Text same | Heading same | Markdown same | Theme same |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 6.86 | 4.70 | 4.69 | 37.87 | 1.29 |
| Memoize `Box` and reuse its style/ref | 5.78 | 4.84 | 4.69 | 30.58 | 1.63 |
| Centralize fonts; memoize typography and markdown styles | 5.71 | 4.03 | 3.94 | 0.63 | 1.20 |
| Stabilize theme actions and context value | 1.07 | 0.96 | 0.86 | 0.33 | 1.22 |
| Share `Box` style mappers per computed theme | 1.01 | 0.90 | 0.79 | 0.31 | 1.21 |

Final same-prop improvements versus baseline:

| Workload | Improvement |
| --- | ---: |
| `Box` | 85.2% |
| `Text` | 80.9% |
| `Heading` | 83.2% |
| `MarkdownView` | 99.2% |
| Theme consumers | 6.4% |

Changed-prop work remains intact: the final medians were 9.02ms for `Box`, 6.89ms for `Text`,
6.52ms for `Heading`, and 28.08ms for `MarkdownView`. This is intentional: memoization skips only
equivalent props, while changed props and theme values still render and are covered by
`P0RenderRegression.test.tsx`.

## August 2026 P1 optimization results

These measurements used the same Cursor Cloud VM and Bun 1.3.11, with 21 measured samples to reduce
variance. The changed `DataTable` workload replaces one cell while preserving the other row
references. Times are milliseconds; lower is better.

| Workload | Phase | Baseline | Optimized | Change |
| --- | --- | ---: | ---: | ---: |
| `DataTable` | Initial render | 23.20 | 24.08 | Within benchmark variance |
| `DataTable` | Same-prop update | 32.49 | 0.18 | 99.4% faster |
| `DataTable` | One-cell update | 31.74 | 1.57 | 95.1% faster |
| `Icon` | Initial render | 1.47 | 1.50 | Within benchmark variance |
| `Icon` | Same-prop update | 1.81 | 0.93 | 48.6% faster |
| `Icon` | Changed-prop update | 3.07 | 3.61 | Full redraw retained |

`DataTable` now reuses equivalent table, content, row, and cell work; computes pinned offsets once;
and applies the default text size without cloning the full grid. `Icon` skips equivalent parent
updates while still redrawing for icon prop and theme changes. `P1RenderRegression.test.tsx` covers
both guarantees.

The P1 example renderers import public component subpaths such as `@terreno/ui/DataTable` and
`@terreno/ui/Icon`. These subpaths avoid evaluating the complete root export graph. The root
`@terreno/ui` import and existing direct `src`/`dist` paths remain supported.

## August 2026 P2 responsive Box optimization results

These measurements used the same Cursor Cloud VM and Bun 1.3.11, with 21 measured samples. Times
are milliseconds; lower is better.

| Phase | Baseline | Optimized | Change |
| --- | ---: | ---: | ---: |
| Initial render | 3.01 | 3.12 | Within benchmark variance |
| Same-prop update | 0.89 | 0.88 | Within benchmark variance |
| One-direction update | 0.92 | 0.90 | Within benchmark variance |
| Initial `Dimensions.get` calls | 1,500 | 1 | 99.9% fewer |

Responsive Boxes now subscribe to one shared window-dimension source. A resize or rotation updates
the cached breakpoint and every subscribed Box without a synchronous dimension read per responsive
prop. Non-responsive Boxes do not subscribe. Focused regressions cover the native 320pt / 375pt / 600pt /
1024pt boundaries, the web 1024pt / 1280pt desktop boundaries, listener sharing, cleanup, and
changed responsive styles.

## Environment overrides

Increase samples or workload size when comparing smaller changes:

```bash
UI_P0_BENCHMARK_SAMPLES=21 \
UI_P0_BENCHMARK_WARMUPS=3 \
UI_P0_BENCHMARK_SIZE=1000 \
bun run performance:p0
```

```bash
UI_P1_BENCHMARK_SAMPLES=21 \
UI_P1_BENCHMARK_WARMUPS=3 \
UI_P1_BENCHMARK_TABLE_ROWS=200 \
UI_P1_BENCHMARK_ICONS=1000 \
bun run performance:p1
```

```bash
UI_P2_RESPONSIVE_BOX_BENCHMARK_SAMPLES=21 \
UI_P2_RESPONSIVE_BOX_BENCHMARK_WARMUPS=3 \
UI_P2_RESPONSIVE_BOX_BENCHMARK_SIZE=1000 \
bun run performance:p2:responsive-box
```

The benchmarks print machine-readable `UI_P0_BENCHMARK_RESULTS`,
`UI_P1_BENCHMARK_RESULTS`, or `UI_P2_RESPONSIVE_BOX_BENCHMARK_RESULTS` JSON lines for CI or local
reporting.
