#!/usr/bin/env python3
"""Build distro-labelled source archives and an optional GitHub npm transport."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag")
    parser.add_argument("--npm", action="store_true")
    args = parser.parse_args()
    meta = json.loads((ROOT / "distro.json").read_text())
    expected = f"{meta['id']}-v{meta['version']}"
    if args.tag and args.tag != expected:
        raise SystemExit(f"Tag must be {expected}; got {args.tag}")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    # Worktree bytes are used so local pre-commit validation is possible. CI builds
    # from a clean checkout of the release tag and records the exact source SHA.
    manifest = {**meta, "sourceCommit": commit}
    stem = f"lemmaduck-{meta['id']}-{meta['version']}"
    output = ROOT / "build" / "release"
    output.mkdir(parents=True, exist_ok=True)
    files = []
    with tempfile.TemporaryDirectory() as temp:
        staging = Path(temp) / stem
        staging.mkdir()
        for relative in tracked:
            if not relative:
                continue
            source = ROOT / relative
            if source.is_symlink():
                raise SystemExit(f"Release cannot include symlink: {relative}")
            if source.is_file():
                target = staging / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
        (staging / "release-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        archive = output / (stem + ".tar.gz")
        with tarfile.open(archive, "w:gz") as tar:
            tar.add(staging, arcname=stem)
        files.append(archive)
        archive = output / (stem + ".zip")
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for path in sorted(staging.rglob("*")):
                if path.is_file():
                    z.write(path, str(Path(stem) / path.relative_to(staging)))
        files.append(archive)
        if args.npm:
            package = json.loads((staging / "package.json").read_text())
            package["name"] = meta["githubPackage"]
            package["publishConfig"] = {"registry":"https://npm.pkg.github.com"}
            package["lemmaduckDistro"] = meta["id"]
            (staging / "package.json").write_text(json.dumps(package, indent=2) + "\n")
            if meta["id"] == "base":
                if not (ROOT / "dist/cli.js").is_file():
                    raise SystemExit("Run npm ci and npm run build before building the base npm package")
                shutil.copytree(ROOT / "dist", staging / "dist")
                lockpath = staging / "npm-shrinkwrap.json"
                lock = json.loads(lockpath.read_text())
                lock["name"] = package["name"]
                lock["packages"][""]["name"] = package["name"]
                lockpath.write_text(json.dumps(lock, indent=2) + "\n")
            result = subprocess.check_output(["npm", "pack", "--ignore-scripts", "--json", "--pack-destination", str(output)], cwd=staging, text=True)
            packed = output / json.loads(result)[0]["filename"]
            target = output / (stem + ".npm.tgz")
            packed.replace(target)
            files.append(target)
    record = output / (stem + ".manifest.json")
    record.write_text(json.dumps(manifest, indent=2) + "\n")
    files.append(record)
    checksums = output / (stem + ".sha256")
    checksums.write_text("".join(hashlib.sha256(file.read_bytes()).hexdigest() + "  " + file.name + "\n" for file in files))
    print(json.dumps({"distro":meta["id"], "tag":expected, "files":[str(p) for p in [*files,checksums]]}, indent=2))

if __name__ == "__main__":
    main()
