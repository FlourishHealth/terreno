# Benchmark tsgo against TypeScript 6

Install the native compilers outside the workspace lockfile, then time every
package:

```bash
mkdir -p /tmp/ts-compilers/tsc6 /tmp/ts-compilers/tsgo /tmp/ts-compilers/tsc7
(cd /tmp/ts-compilers/tsc6 && bun add typescript@6.0.3)
(cd /tmp/ts-compilers/tsgo && bun add @typescript/native-preview)
(cd /tmp/ts-compilers/tsc7 && bun add typescript@7.0.2)
python3 scripts/ci/benchmark-tsgo.py
```

Writes `/opt/cursor/artifacts/tsgo-benchmark.jsonl` and
`/opt/cursor/artifacts/tsgo-benchmark.md`. Simulate CircleCI medium with
`GOMAXPROCS=2 python3 scripts/ci/benchmark-tsgo.py`.

The overlay tsconfigs exist only for the native checker. Do not copy them into
published packages. Why we stay on TypeScript 6: [Native TypeScript](../explanation/native-typescript.md).
