#!/bin/bash
# Run all .mjs integration tests in this directory
set -e

for f in "$(dirname "$0")"/*.mjs; do
  echo "\n===== Running $f ====="
  node "$f"
done

echo "\nAll integration tests completed."
