#!/bin/sh
set -eu
task_repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$task_repo"
./duck setup --full
exec python3 scripts/setup.py "$@"
