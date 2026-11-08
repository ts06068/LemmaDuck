#!/usr/bin/env python3
"""Check reachable commit subjects against the project's Conventional Commit types."""
import re
import subprocess
import sys

PATTERN = re.compile(r"^(?:feat|fix|build|chore|ci|docs|style|refactor|perf|test|revert)(?:\([^()\r\n]+\))?!?: [^\s].*$")


def main():
    rows = subprocess.check_output(["git", "log", "--all", "--format=%h %s"], text=True).splitlines()
    invalid = [row for row in rows if not PATTERN.fullmatch(row.split(" ", 1)[1])]
    if invalid:
        print("Use type(scope): description for these commits:", *invalid, sep="\n", file=sys.stderr)
        return 1
    print(f"Conventional Commits: {len(rows)} reachable commits checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
