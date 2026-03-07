#!/bin/bash
# Netlify does not deploy files in dot-prefixed directories (e.g. .bun).
# Expo export generates asset paths through bun's symlink-resolved .bun cache.
# This script renames .bun to _bun in both the filesystem and JS bundle references.

set -euo pipefail

DIST_DIR="${1:-dist}"

if [ ! -d "$DIST_DIR" ]; then
  echo "Error: dist directory '$DIST_DIR' not found"
  exit 1
fi

# Check if .bun directories exist in assets
if ! find "$DIST_DIR/assets" -type d -name ".bun" 2>/dev/null | grep -q .; then
  echo "No .bun directories found in assets, skipping"
  exit 0
fi

echo "Fixing .bun asset paths for Netlify deployment..."

# Rename .bun directories to _bun in the filesystem
find "$DIST_DIR/assets" -type d -name ".bun" | while read -r dir; do
  new_dir="${dir/.bun/_bun}"
  echo "  Renaming: $dir -> $new_dir"
  mv "$dir" "$new_dir"
done

# Update references in JS bundles
find "$DIST_DIR" -name "*.js" -type f | while read -r jsfile; do
  if grep -q '\.bun/' "$jsfile"; then
    echo "  Updating references in: $jsfile"
    sed -i 's/\.bun\//_bun\//g' "$jsfile"
  fi
done

echo "Done fixing asset paths"
