# Native TypeScript (`tsgo` / TypeScript 7)

Stay on TypeScript **6.0.3** `tsc` for compile and typecheck. `tsgo` is not a
drop-in replacement for this monorepo, and it would not cut most CircleCI job
wall clocks.

`tsgo` is the CLI from `@typescript/native-preview`. TypeScript **7.0.2** ships
the same native Go compiler as `tsc`. Both reject every Terreno tsconfig that
still sets `ignoreDeprecations: "6.0"` plus removed 6.0 flags (`baseUrl`,
`downlevelIteration`, `target: es5`, `moduleResolution: node`).

## What we measured

Local machine: 8 CPU, 2026-09-22. Compilers: `tsc` 6.0.3 vs `tsgo`
7.0.0-dev.20260707.2 vs `tsc` 7.0.2. Overlay configs strip 6.0-deprecated
options so the native checker can run; they are **not** production emit
(CommonJS packages use `module: preserve` in the overlay).

| package | tsc 6 | tsgo overlay | speedup |
| --- | ---: | ---: | ---: |
| `@terreno/api` | 7.6s | 2.2s | 3.4x |
| `@terreno/ui` | 6.0s | 1.2s | 4.8x |
| `example-backend` | 5.2s | 1.8s | 2.9x |
| `@terreno/syncdb` | 2.2s | 0.27s | 8.2x |
| `@terreno/rtk` | 2.7s | 0.37s | 7.3x |
| Sequential all 19 packages | 53.3s | 15.6s | 3.4x |

`rtk` and `syncdb` already typecheck on native **without** an overlay (no
`ignoreDeprecations`). Drop-in `tsgo` on the other packages fails in under 2s
on config errors and never typechecks.

Native speed depends on cores. CircleCI **medium** is 2 vCPU:

| | 8 CPU | `GOMAXPROCS=2` | `GOMAXPROCS=1` |
| --- | ---: | ---: | ---: |
| api tsgo | 2.2s | 5.1s | 9.5s (slower than tsc 6 at 7.9s) |
| ui tsgo | 1.1s | 1.5s | 2.3s (tsc 6 is 5.7s) |

## CircleCI impact

`bun run compile` (TypeScript 6, including duplicate dep compiles and MCP doc
sync) is **60s** locally and **112–119s** in `e2e-prepare` (`large`, 4 vCPU).
Maestro's compile step is **136s**. Expo `export` in the same jobs is
**187–198s**.

| Job | Compile today | Tests / export | If native ~3x on 4 CPU |
| --- | ---: | --- | --- |
| `e2e-prepare` | 112–119s | export 187–198s | save ~70–90s; job still ~4–5 min |
| `maestro-e2e` | 136s | export + Maestro | save ~90s; job still ~8 min |
| `example-backend-ci` | dep compile 102s | tests 46s | largest package-job win |
| `api-ci` | ~8s of a 568s lint/compile/test step | bun tests dominate | save seconds, not minutes |
| `ui-ci` | bundled in 95s lint/compile/test | tests dominate | modest |

PR wall clock is the slowest parallel job. Speeding compile does not move
`api-ci` (~10 min) or test-heavy shards. It trims `e2e-prepare` and Maestro,
but Expo export remains the bigger half of those jobs.

## What would have to change first

1. Remove `ignoreDeprecations: "6.0"` and the removed flags from every
   tsconfig (`baseUrl`, `downlevelIteration`, `target: es5`,
   `moduleResolution: node`).
2. Decide emit: published backends today target **ES5 CommonJS**. TypeScript 7
   does not support `target: es5` or `moduleResolution: node`.
3. Keep TypeScript 6 for tools that need the compiler API (`@typescript/typescript6`
   / `tsc6`) if eslint or similar still imports `typescript`.
4. Pin `--checkers` on 2-vCPU jobs so native workers do not oversubscribe.

Until that migration lands, swapping `tsc` for `tsgo` in `package.json` scripts
fails CI immediately.

Re-run the comparison: [Benchmark tsgo](../how-to/benchmark-tsgo.md).
