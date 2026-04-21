#!/usr/bin/env python3
"""Proper LCOV merge: take MAX hits per line across all runs, and for each
source file use the widest line set (most lines instrumented by any run)."""
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
                if current_sf not in files:
                    files[current_sf] = {"DA": {}, "BRDA": {}, "FN": {}, "FNDA": {}}
            elif line.startswith("DA:") and current_sf:
                parts = line[3:].split(",")
                if len(parts) >= 2:
                    ln = int(parts[0]); hits = int(parts[1])
                    existing = files[current_sf]["DA"].get(ln, 0)
                    files[current_sf]["DA"][ln] = max(existing, hits)
            elif line == "end_of_record":
                current_sf = None
    return files

all_files = {}
for lcov in sorted(glob.glob("coverage/*/lcov.info")):
    parsed = parse(lcov)
    for sf, info in parsed.items():
        if sf not in all_files:
            all_files[sf] = {"DA": {}}
        for ln, hits in info["DA"].items():
            existing = all_files[sf]["DA"].get(ln, 0)
            all_files[sf]["DA"][ln] = max(existing, hits)

# Filter: only src/ files, exclude tests
def include(sf):
    if "/node_modules/" in sf: return False
    if not (sf.startswith("src/") or "admin-frontend/src/" in sf): return False
    base = os.path.basename(sf)
    if base.endswith(".test.tsx") or base.endswith(".test.ts"): return False
    if ".isolated." in base: return False
    if base == "index.ts": return False
    return True

total_lines = 0
covered_lines = 0
per_file = []
for sf in sorted(all_files.keys()):
    if not include(sf): continue
    da = all_files[sf]["DA"]
    tl = len(da)
    cl = sum(1 for h in da.values() if h > 0)
    if tl == 0: continue
    total_lines += tl
    covered_lines += cl
    per_file.append((sf, cl, tl, 100.0*cl/tl))

per_file.sort(key=lambda x: x[3])
for sf, cl, tl, pct in per_file:
    short = sf.replace("src/", "", 1) if sf.startswith("src/") else sf.split("admin-frontend/src/")[-1]
    print(f"{pct:6.2f}%  {cl:4d}/{tl:4d}  {short}")
print()
if total_lines:
    print(f"TOTAL: {covered_lines}/{total_lines} = {100.0*covered_lines/total_lines:.2f}%")
