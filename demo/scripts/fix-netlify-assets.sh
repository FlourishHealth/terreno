#!/bin/bash
# Expo export generates asset paths through bun's symlink-resolved .bun cache,
# creating deeply nested paths with special characters (@, +) under
# assets/_node_modules/.bun/. These paths break on Netlify because:
# 1. Netlify skips dot-prefixed directories (.bun)
# 2. Special characters in paths may cause issues with artifact upload
#
# This script flattens all assets into assets/_flat/ using their hash filenames
# and updates all references in the JS bundle.

set -euo pipefail

DIST_DIR="${1:-dist}"

if [ ! -d "$DIST_DIR" ]; then
  echo "Error: dist directory '$DIST_DIR' not found"
  exit 1
fi

ASSETS_DIR="$DIST_DIR/assets"
if [ ! -d "$ASSETS_DIR/_node_modules" ]; then
  echo "No _node_modules assets found, skipping"
  exit 0
fi

FLAT_DIR="$ASSETS_DIR/_flat"
mkdir -p "$FLAT_DIR"

echo "Flattening asset paths for Netlify deployment..."

# Build a sed script to do all replacements at once
SED_SCRIPT=""

find "$ASSETS_DIR/_node_modules" -type f | while read -r filepath; do
  filename="$(basename "$filepath")"
  cp "$filepath" "$FLAT_DIR/$filename"

  # Build the old path as it appears in the JS bundle (relative from root)
  old_path="${filepath#"$DIST_DIR"/}"
  new_path="assets/_flat/$filename"

  echo "  $filename"
done

# Now do the replacement in JS and HTML files using node for reliable string replacement
# since sed struggles with paths containing @, +, etc.
find "$DIST_DIR" \( -name "*.js" -o -name "*.html" \) -type f | while read -r file; do
  if grep -q '_node_modules/' "$file"; then
    echo "  Updating references in: $(basename "$file")"
    node -e "
      const fs = require('fs');
      let content = fs.readFileSync('$file', 'utf8');
      // Match any path like assets/_node_modules/.../<filename> and replace with assets/_flat/<filename>
      content = content.replace(/assets\/_node_modules\/[^\"'\`]+\/([^\/\"'\`]+)/g, 'assets/_flat/\$1');
      fs.writeFileSync('$file', content);
    "
  fi
done

# Remove the old _node_modules directory
rm -rf "$ASSETS_DIR/_node_modules"

echo "Done. Flattened $(find "$FLAT_DIR" -type f | wc -l) assets"
