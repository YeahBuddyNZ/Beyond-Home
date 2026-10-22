#!/bin/sh
# Every test. Usage: sh tests/run.sh
set -e
cd "$(dirname "$0")/.."
node --check beyond_home/server/main.mjs
node --test tests/*.test.mjs
