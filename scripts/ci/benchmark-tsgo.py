#!/usr/bin/env python3
"""Time TypeScript 6 tsc vs native tsgo / TypeScript 7 tsc on workspace packages.

Native compilers reject Terreno's current `ignoreDeprecations: "6.0"` configs, so
this script also times a TS7-compat overlay (removed 6.0-deprecated options only).
That overlay is for speed comparison, not production emit.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TSC6 = Path(os.environ.get("TSC6", "/tmp/ts-compilers/tsc6/node_modules/.bin/tsc"))
TSGO = Path(os.environ.get("TSGO", "/tmp/ts-compilers/tsgo/node_modules/.bin/tsgo"))
TSC7 = Path(os.environ.get("TSC7", "/tmp/ts-compilers/tsc7/node_modules/.bin/tsc"))
OUT = Path(os.environ.get("BENCHMARK_TSGO_OUT", "/opt/cursor/artifacts/tsgo-benchmark.jsonl"))
SUMMARY = Path(os.environ.get("BENCHMARK_TSGO_SUMMARY", "/opt/cursor/artifacts/tsgo-benchmark.md"))

PACKAGES: list[dict[str, str]] = [
    {"name": "test", "project": "tsconfig.json", "dist": "dist"},
    {"name": "api", "project": "tsconfig.json", "dist": "dist"},
    {"name": "api-health", "project": "tsconfig.json", "dist": "dist"},
    {"name": "admin-backend", "project": "tsconfig.json", "dist": "dist"},
    {"name": "announcements", "project": "tsconfig.json", "dist": "dist"},
    {"name": "jobs", "project": "tsconfig.json", "dist": "dist"},
    {"name": "comms", "project": "tsconfig.json", "dist": "dist"},
    {"name": "ai", "project": "tsconfig.json", "dist": "dist"},
    {"name": "feature-flags", "project": "tsconfig.json", "dist": "dist"},
    {"name": "create-terreno-app", "project": "tsconfig.json", "dist": "dist"},
    {"name": "example-backend", "project": "tsconfig.json", "dist": ""},
    {"name": "rtk", "project": "tsconfig.json", "dist": "dist"},
    {"name": "syncdb", "project": "tsconfig.json", "dist": "dist"},
    {"name": "ui", "project": "tsconfig.json", "dist": "dist"},
    {"name": "admin-frontend", "project": "tsconfig.json", "dist": "dist"},
    {"name": "admin-spa", "project": "tsconfig.server.json", "dist": "src/dist"},
    {"name": "mcp-server", "project": "tsconfig.json", "dist": "dist"},
    {"name": "demo", "project": "tsconfig.json", "dist": ""},
    {"name": "website", "project": "tsconfig.json", "dist": ""},
]


def load_tsconfig(path: Path) -> dict:
    proc = subprocess.run(
        [
            "node",
            "-e",
            """
const path = require("path");
const ts = require("/tmp/ts-compilers/tsc6/node_modules/typescript");

const readMerged = (configPath) => {
  const {config, error} = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\\n"));
  }
  if (!config.extends) {
    return config;
  }
  const extendsList = Array.isArray(config.extends) ? config.extends : [config.extends];
  let merged = {};
  for (const ext of extendsList) {
    const dir = path.dirname(configPath);
    const candidates = ext.startsWith(".")
      ? [path.resolve(dir, ext)]
      : [ext, ext + ".json", ext + "/tsconfig.json"];
    let extPath = null;
    for (const candidate of candidates) {
      try {
        extPath = require.resolve(candidate, {paths: [dir]});
        break;
      } catch {
        /* try next */
      }
    }
    if (!extPath) {
      throw new Error("Cannot resolve tsconfig extends " + ext + " from " + configPath);
    }
    const parent = readMerged(extPath);
    merged = {
      ...parent,
      ...config,
      compilerOptions: {...(parent.compilerOptions || {}), ...(config.compilerOptions || {})},
    };
  }
  delete merged.extends;
  return merged;
};

const merged = readMerged(process.argv[1]);
process.stdout.write(JSON.stringify(merged));
""",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"parse {path}: {proc.stderr or proc.stdout}")
    return json.loads(proc.stdout)


def ts7_overlay(cfg: dict) -> dict:
    overlay = json.loads(json.dumps(cfg))
    overlay.pop("extends", None)
    opts = overlay.setdefault("compilerOptions", {})
    for key in ("ignoreDeprecations", "downlevelIteration", "baseUrl"):
        opts.pop(key, None)
    target = str(opts.get("target", "")).lower()
    if target in {"es3", "es5", "es6", "es2015"}:
        opts["target"] = "es2017"
    module_name = str(opts.get("module", "")).lower()
    if module_name in {"amd", "umd", "system", "systemjs", "none", "commonjs"}:
        # Typecheck overlay only: Node16 emit is not equivalent to today's CommonJS
        # `outDir` builds. `preserve` + `bundler` is enough to measure checker speed.
        opts["module"] = "preserve"
        opts["moduleResolution"] = "bundler"
        module_name = "preserve"
    else:
        module_resolution = str(opts.get("moduleResolution", "bundler")).lower()
        if module_resolution in {"node", "node10", "classic"}:
            if module_name in {"nodenext", "node16"}:
                opts["moduleResolution"] = "nodenext"
            else:
                opts["moduleResolution"] = "bundler"
    if opts.get("esModuleInterop") is False:
        opts["esModuleInterop"] = True
    if opts.get("allowSyntheticDefaultImports") is False:
        opts["allowSyntheticDefaultImports"] = True
    paths = opts.get("paths")
    if isinstance(paths, dict):
        rewritten: dict[str, list[str]] = {}
        for alias, mappings in paths.items():
            next_mappings: list[str] = []
            for mapping in mappings:
                if mapping.startswith("./") or mapping.startswith("../"):
                    next_mappings.append(mapping)
                else:
                    next_mappings.append(f"./{mapping}")
            rewritten[alias] = next_mappings
        opts["paths"] = rewritten
    return overlay


def timed(cmd: list[str], cwd: Path) -> tuple[int, int, str]:
    start = time.perf_counter()
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    ms = int((time.perf_counter() - start) * 1000)
    err = (proc.stderr or "") + (proc.stdout or "")
    return proc.returncode, ms, err[-4000:]


def write_overlay(pkg: dict) -> Path:
    src = ROOT / pkg["name"] / pkg["project"]
    overlay_path = ROOT / pkg["name"] / ".tsconfig.tsgo.bench.json"
    overlay_path.write_text(json.dumps(ts7_overlay(load_tsconfig(src)), indent=2))
    return overlay_path


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    print(
        f"nproc={os.cpu_count()} GOMAXPROCS={os.environ.get('GOMAXPROCS', 'unset')}"
    )
    for pkg in PACKAGES:
        pkg_dir = ROOT / pkg["name"]
        dist = pkg["dist"]
        overlay = write_overlay(pkg)
        runs = [
            ("tsc6", [str(TSC6), "-p", pkg["project"]]),
            ("tsgo-as-is", [str(TSGO), "-p", pkg["project"]]),
            ("tsc7-as-is", [str(TSC7), "-p", pkg["project"]]),
            ("tsgo-overlay", [str(TSGO), "-p", overlay.name]),
            ("tsc7-overlay", [str(TSC7), "-p", overlay.name]),
        ]
        print(f"=== {pkg['name']} ===")
        try:
            for compiler, cmd in runs:
                if dist:
                    shutil.rmtree(pkg_dir / dist, ignore_errors=True)
                status, ms, err = timed(cmd, pkg_dir)
                first_err = next(
                    (line for line in err.splitlines() if "error TS" in line),
                    "",
                )
                row = {
                    "package": pkg["name"],
                    "compiler": compiler,
                    "ms": ms,
                    "status": status,
                    "firstError": first_err,
                }
                rows.append(row)
                print(f"  {compiler:12} {ms:7}ms status={status} {first_err[:110]}")
        finally:
            overlay.unlink(missing_ok=True)
    OUT.write_text("".join(json.dumps(row) + "\n" for row in rows))
    by_pkg: dict[str, dict[str, dict]] = {}
    for row in rows:
        by_pkg.setdefault(row["package"], {})[row["compiler"]] = row
    lines = [
        "| package | tsc6 | tsgo as-is | tsc7 as-is | tsgo overlay | tsc7 overlay | overlay speedup |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    tsc6_sum = overlay_sum = 0
    for pkg in PACKAGES:
        data = by_pkg[pkg["name"]]
        tsc6 = data["tsc6"]["ms"]
        tsgo_as = data["tsgo-as-is"]["ms"]
        tsc7_as = data["tsc7-as-is"]["ms"]
        tsgo_ov = data["tsgo-overlay"]["ms"]
        tsc7_ov = data["tsc7-overlay"]["ms"]
        ok6 = data["tsc6"]["status"] == 0
        ok_ov = data["tsgo-overlay"]["status"] == 0
        if ok6:
            tsc6_sum += tsc6
        if ok_ov:
            overlay_sum += tsgo_ov
        speed = f"{(tsc6 / tsgo_ov):.2f}x" if tsgo_ov else "-"
        if not ok_ov:
            speed += " (errors)"
        if not ok6:
            speed += " (tsc6 errors)"
        lines.append(
            f"| {pkg['name']} | {tsc6}ms | {tsgo_as}ms | {tsc7_as}ms | {tsgo_ov}ms | {tsc7_ov}ms | {speed} |"
        )
    ratio = f"{(tsc6_sum / overlay_sum):.2f}x" if overlay_sum else "-"
    lines.append(
        f"| TOTAL (successful) | {tsc6_sum}ms |  |  | {overlay_sum}ms |  | {ratio} |"
    )
    SUMMARY.write_text("\n".join(lines) + "\n")
    print("\n" + "\n".join(lines))
    print(f"\nWrote {OUT} and {SUMMARY}")


if __name__ == "__main__":
    main()
