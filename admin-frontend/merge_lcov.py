#!/usr/bin/env python3
"""Merge LCOV coverage across multiple bun:test runs.

For each source file we compute the MAX hit count per line across all runs,
but we only consider line numbers that appear in at least one run where the
file has positive coverage. This avoids over-counting un-exercised runs
that instrument every source line (including non-executable ones like
closing braces) as zero."""
import glob
import os

def parse(lcov_path):
    files = {}
    current_sf = None
    with open(lcov_path) as f:
        for raw in f:
            line = raw.strip()
            if line.startswith("SF:"):
                current_sf = line[3:]
                files.setdefault(current_sf, {"DA": {}})
            elif line.startswith("DA:") and current_sf:
                parts = line[3:].split(",")
                if len(parts) >= 2:
                    ln = int(parts[0])
                    hits = int(parts[1])
                    existing = files[current_sf]["DA"].get(ln, 0)
                    files[current_sf]["DA"][ln] = max(existing, hits)
            elif line == "end_of_record":
                current_sf = None
    return files


runs = []
for lcov in sorted(glob.glob("coverage/*/lcov.info")):
    runs.append(parse(lcov))

all_sfs = set()
for run in runs:
    all_sfs.update(run.keys())

merged = {}
for sf in all_sfs:
    # For each run that has this file, compute its hit ratio. Pick the run
    # with the highest ratio as the authoritative line set (since bun's
    # instrumenter is stricter about executable lines when a file is
    # actually exercised vs simply imported for side-effects). Then merge
    # hits from all other runs onto that line set using MAX.
    runs_with_sf = [r[sf] for r in runs if sf in r]
    if not runs_with_sf:
        continue

    def ratio(info):
        da = info["DA"]
        if not da:
            return 0.0
        cov = sum(1 for h in da.values() if h > 0)
        return cov / len(da)

    best = max(runs_with_sf, key=ratio)
    da = dict(best["DA"])
    for info in runs_with_sf:
        if info is best:
            continue
        for ln, h in info["DA"].items():
            if ln in da:
                da[ln] = max(da[ln], h)
    merged[sf] = da


def include(sf):
    if "/node_modules/" in sf:
        return False
    if not (sf.startswith("src/") or "admin-frontend/src/" in sf):
        return False
    base = os.path.basename(sf)
    if base.endswith(".test.tsx") or base.endswith(".test.ts"):
        return False
    if ".isolated." in base:
        return False
    if base == "index.ts":
        return False
    return True


total_lines = 0
covered_lines = 0
per_file = []
for sf in sorted(merged):
    if not include(sf):
        continue
    da = merged[sf]
    tl = len(da)
    cl = sum(1 for h in da.values() if h > 0)
    if tl == 0:
        continue
    total_lines += tl
    covered_lines += cl
    per_file.append((sf, cl, tl, 100.0 * cl / tl))

per_file.sort(key=lambda x: x[3])
for sf, cl, tl, pct in per_file:
    if sf.startswith("src/"):
        short = sf[len("src/"):]
    else:
        short = sf.split("admin-frontend/src/")[-1]
    print(f"{pct:6.2f}%  {cl:4d}/{tl:4d}  {short}")
print()
if total_lines:
    print(f"TOTAL: {covered_lines}/{total_lines} = {100.0 * covered_lines / total_lines:.2f}%")
