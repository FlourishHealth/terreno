# UI performance benchmarks

Run the P0 render benchmark after changing core UI primitives:

```bash
cd ui
bun run performance:p0
```

The benchmark renders large trees through the same React Native test environment as the UI
component suite. It reports median wall-clock times after two warmups and seven measured samples:

- 500 `Box`, `Text`, and `Heading` instances
- 100 `MarkdownView` instances
- 500 theme consumers
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

## Environment overrides

Increase samples or workload size when comparing smaller changes:

```bash
UI_P0_BENCHMARK_SAMPLES=21 \
UI_P0_BENCHMARK_WARMUPS=3 \
UI_P0_BENCHMARK_SIZE=1000 \
bun run performance:p0
```

The benchmark prints one machine-readable `UI_P0_BENCHMARK_RESULTS` JSON line for CI or local
reporting.
