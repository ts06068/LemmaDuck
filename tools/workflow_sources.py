#!/usr/bin/env python3
"""Fetch or check the pinned Git objects in a LemmaDuck workflow-source lock."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def git(repo, *args, input_data=None):
    return subprocess.run(
        ["git", "-C", str(repo), "-c", "core.hooksPath=" + os.devnull, *args],
        input=input_data, stdout=subprocess.PIPE, check=True,
    ).stdout


def inventory(spec):
    with (ROOT / spec["inventory"]).open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream, delimiter="\t"))
    result = {r["path"]: (r["mode"], r["git_blob_sha1"], int(r["bytes"])) for r in rows}
    if len(result) != len(rows) or len(result) != spec["entries"]:
        raise ValueError("Duplicate or missing lock rows")
    return result


def verify(repo, spec):
    commit = spec["commit"]
    actual_commit = git(repo, "rev-parse", "--verify", commit + "^{commit}").decode().strip()
    root_tree = git(repo, "rev-parse", commit + "^{tree}").decode().strip()
    if (actual_commit, root_tree) != (commit, spec["root_tree"]):
        raise ValueError("Git commit or root tree differs from the lock")
    paths = [] if spec["paths"] == ["."] else spec["paths"]
    listing = git(repo, "ls-tree", "-r", "-z", "-l", commit, "--", *paths)
    actual = {}
    for entry in listing.split(b"\0"):
        if not entry:
            continue
        metadata, path = entry.split(b"\t", 1)
        mode, kind, oid, size = metadata.decode("ascii").split()
        if kind != "blob":
            raise ValueError("Unexpected Git object at " + os.fsdecode(path))
        actual[path.decode("utf-8")] = (mode, oid, int(size))
    expected = inventory(spec)
    if actual != expected:
        differences = sorted(p for p in actual.keys() | expected.keys() if actual.get(p) != expected.get(p))
        raise ValueError("Inventory differs: " + ", ".join(differences[:8]))
    sizes_by_oid = {oid: size for _, oid, size in actual.values()}
    with subprocess.Popen(
        ["git", "-C", str(repo), "cat-file", "--batch"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
    ) as child:
        try:
            for oid, size in sorted(sizes_by_oid.items()):
                child.stdin.write(oid.encode("ascii") + b"\n")
                child.stdin.flush()
                header = child.stdout.readline().split()
                if header != [oid.encode(), b"blob", str(size).encode()]:
                    raise ValueError("Missing or unexpected object " + oid)
                digest = hashlib.sha1(b"blob " + str(size).encode("ascii") + b"\0")
                remaining = size
                while remaining:
                    block = child.stdout.read(min(remaining, 1024 * 1024))
                    if not block:
                        raise ValueError("Truncated Git object " + oid)
                    digest.update(block)
                    remaining -= len(block)
                if child.stdout.read(1) != b"\n" or digest.hexdigest() != oid:
                    raise ValueError("Blob verification failed: " + oid)
        finally:
            child.stdin.close()
            child.stdout.close()
        if child.wait() != 0:
            raise ValueError("git cat-file failed")
    return len(actual)


def fetch(repo, spec):
    # Refuse any existing destination. A failed download leaves only this new folder.
    repo.mkdir(parents=False, exist_ok=False)
    git(repo, "init", "-q")
    git(repo, "fetch", "--no-tags", "--depth=1", "--no-recurse-submodules", spec["remote"], spec["commit"])
    nfiles = verify(repo, spec)
    if spec["paths"] != ["."]:
        patterns = "".join("/" + p + "\n" for p in spec["paths"])
        git(repo, "sparse-checkout", "set", "--no-cone", "--stdin", input_data=patterns.encode())
    git(repo, "checkout", "-q", "--detach", spec["commit"])
    return nfiles


def main():
    sources = json.loads((ROOT / "locks/upstreams.json").read_text(encoding="utf-8"))["workflow_sources"]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("fetch", "verify"))
    parser.add_argument("source", choices=tuple(sources))
    parser.add_argument("directory", type=Path, help="New checkout path for fetch, existing Git repository for verify")
    options = parser.parse_args()
    spec = sources[options.source]
    nfiles = (fetch if options.action == "fetch" else verify)(options.directory, spec)
    print(f"{options.source}: {nfiles} paths verified at {spec['commit']}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as err:
        print(str(err), file=sys.stderr)
        sys.exit(1)
