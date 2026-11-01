#!/usr/bin/env python3
"""Publish or verify an identical npm artifact, then check its update channel."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

REGISTRY = "https://npm.pkg.github.com"


def npm(*args, check=True):
    result = subprocess.run(["npm", *args, "--registry=" + REGISTRY],
                            text=True, capture_output=True, check=False)
    if check and result.returncode:
        raise SystemExit(result.stdout + result.stderr)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--tag", choices=("latest", "preview"), required=True)
    args = parser.parse_args()
    with tarfile.open(args.archive) as archive:
        package = json.load(archive.extractfile("package/package.json"))
    name, version = package["name"], package["version"]
    if name not in {"@ts06068/lemmaduck-" + distro for distro in ("base", "emacs", "neovim")}:
        raise SystemExit("Unexpected package identity")
    spec = name + "@" + version
    expected = "sha512-" + base64.b64encode(hashlib.sha512(args.archive.read_bytes()).digest()).decode()
    existing = npm("view", spec, "dist.integrity", "--json", check=False)
    if existing.returncode:
        try:
            error = json.loads(existing.stdout)
        except json.JSONDecodeError:
            raise SystemExit(existing.stdout + existing.stderr)
        if error.get("error", {}).get("code") != "E404":
            raise SystemExit(existing.stdout + existing.stderr)
        npm("publish", str(args.archive), "--tag", args.tag, "--ignore-scripts")
    elif json.loads(existing.stdout) != expected:
        raise SystemExit("This version already exists with different bytes; increment the version")
    integrity = json.loads(npm("view", spec, "dist.integrity", "--json").stdout)
    if integrity != expected:
        raise SystemExit("Published package integrity differs from the built artifact")
    npm("dist-tag", "add", spec, args.tag)
    channel = npm("view", name + "@" + args.tag, "version").stdout.strip()
    if channel != version:
        raise SystemExit("Registry update channel points to an unexpected version")
    print(json.dumps({"package": name, "version": version, "channel": args.tag,
                      "registry": REGISTRY, "integrity": integrity}, indent=2))


if __name__ == "__main__":
    main()
