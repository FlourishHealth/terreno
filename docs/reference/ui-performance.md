# UI performance benchmarks

Run the benchmark that covers the component being changed:

```bash
cd ui
bun run performance:p0
bun run performance:p1
bun run performance:p2:button
bun run performance:imports
```

The benchmarks render large trees through the same React Native test environment as the UI
component suite. They report median wall-clock times after two warmups and seven measured samples:

- 500 `Box`, `Text`, and `Heading` instances
- 100 `MarkdownView` instances
- 500 theme consumers
- a 100-row, eight-column `DataTable` with two pinned columns
- 500 `Icon` instances
- 500 plain `Button` instances and 100 confirmation `Button` instances
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

## August 2026 root import optimization results

These measurements used the same Cursor Cloud VM and Bun 1.3.11. Each workload uses a fresh Bun test process
(seven measured samples, two warmups). The graph columns count evaluated `@terreno/ui` source modules reached through
static `import`/`export` edges (type-only re-exports are excluded). Output bytes sum those module file sizes. Elapsed
time includes dependency evaluation in the Bun test harness. Lower is better.

| Workload | Modules | Output bytes | Elapsed (ms) | Baseline modules | Baseline bytes | Baseline elapsed (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `@terreno/ui/Button` subpath | 17 | 345,992 | 22.8 | 19 | 383,185 | 22.3 |
| `@terreno/ui` root | 138 | 889,124 | 189.3 | 151 | 1,031,537 | 207.9 |
| `@terreno/ui/DataTable` subpath | 25 | 387,392 | 24.9 | 26 | 424,006 | 44.6 |
| `@terreno/ui/MarkdownView` subpath | 5 | 19,036 | 3.5 | 7 | 148,456 | 27.0 |

Changes in this slice:

- Measured heavy optional widgets (`GPTChat`, `EmojiSelector`, `MarkdownEditor`, consent/admin tools, and related
  exports) now cross lazy root boundaries so their implementation files stay off the cold root import path.
- `MarkdownView`, `DataTable` header info, and `EmojiSelector` defer `react-native-markdown-display` and
  `emoji-datasource` until first use.
- `RootImportRegression.test.tsx` and `bun run performance:imports` guard the public entrypoints.

Run the import benchmark locally:

```bash
cd ui
bun run performance:imports
```

Override sample counts when comparing smaller deltas:

```bash
UI_IMPORT_BENCHMARK_SAMPLES=21 \
UI_IMPORT_BENCHMARK_WARMUPS=3 \
bun run performance:imports
```

The benchmark prints a machine-readable `UI_IMPORT_BENCHMARK_RESULTS` JSON line for CI or local reporting.

## August 2026 P2 Button optimization results

These measurements used the same Cursor Cloud VM and Bun 1.3.11, with 21 measured samples. The
changed workload replaces one button label or confirmation message while preserving every other
prop. Times are milliseconds; lower is better.

| Workload | Phase | Baseline | Optimized | Change |
| --- | --- | ---: | ---: | ---: |
| Plain `Button` | Initial render | 7.85 | 8.66 | Within benchmark variance |
| Plain `Button` | Same-prop update | 13.73 | 0.94 | 93.1% faster |
| Plain `Button` | One-label update | 11.99 | 0.98 | 91.8% faster |
| Confirmation `Button` | Initial render | 1.71 | 1.93 | Within benchmark variance |
| Confirmation `Button` | Same-prop update | 2.79 | 0.30 | 89.2% faster |
| Confirmation `Button` | One-message update | 2.71 | 0.32 | 88.3% faster |

`Button` now skips equivalent parent updates, keeps debounce identity stable, and cancels retained
debounce timers on replacement or unmount. Plain buttons use a separate path that does not allocate
confirmation state or request the lazy modal. Delayed handlers remain disabled until completion.
Confirmation buttons clear the press cooldown when the modal closes, so Cancel, dismiss, or Confirm
still allows an immediate reopen while repeated presses that do not close the modal stay debounced.
`P2ButtonRenderRegression.test.tsx` covers equivalent props plus changed labels, confirmation
content, and theme values.

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
UI_P2_BUTTON_BENCHMARK_SAMPLES=21 \
UI_P2_BUTTON_BENCHMARK_WARMUPS=3 \
UI_P2_BUTTON_BENCHMARK_SIZE=1000 \
UI_P2_CONFIRMATION_BUTTON_BENCHMARK_SIZE=200 \
bun run performance:p2:button
```

The benchmarks print machine-readable `UI_P0_BENCHMARK_RESULTS`, `UI_P1_BENCHMARK_RESULTS`,
`UI_P2_BUTTON_BENCHMARK_RESULTS`, or `UI_IMPORT_BENCHMARK_RESULTS` JSON lines for CI or local
reporting.
