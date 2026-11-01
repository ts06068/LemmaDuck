#!/usr/bin/env python3
"""Build distro-labelled source archives and an optional GitHub npm transport."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DISTROS = {"base": ROOT, "emacs": ROOT / "distros/emacs", "neovim": ROOT / "distros/neovim"}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--distro", choices=DISTROS)
    parser.add_argument("--tag")
    parser.add_argument("--npm", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--describe", action="store_true", help="Validate release identity without building")
    parser.add_argument("--github-output", type=Path, help="Write validated identity for subsequent Actions steps")
    args = parser.parse_args()
    distro = args.distro or (args.tag.split("-v", 1)[0] if args.tag else "base")
    if distro not in DISTROS:
        parser.error("Release tag must start with base-v, emacs-v or neovim-v")
    source_root = DISTROS[distro]
    meta = json.loads((source_root / "distro.json").read_text())
    package = json.loads((source_root / "package.json").read_text())
    if meta["id"] != distro or package["version"] != meta["version"]:
        raise SystemExit("Distro and package identity/version do not match")
    expected = f"{meta['id']}-v{meta['version']}"
    if args.tag and args.tag != expected:
        raise SystemExit(f"Tag must be {expected}; got {args.tag}")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if "engine" in meta:
        base = json.loads((ROOT / "distro.json").read_text())
        if meta["engine"]["version"] != base["version"]:
            raise SystemExit("Editor engine version must match the shared checkout")
        meta["engine"]["testedCommit"] = commit
    identity = {"distro": distro, "version": meta["version"], "tag": expected,
                "source_dir": source_root.relative_to(ROOT).as_posix(),
                "package_tag": "latest" if meta["channel"] == "stable" else "preview"}
    if args.github_output:
        with args.github_output.open("a") as target:
            target.write("".join(f"{key}={value}\n" for key, value in identity.items()))
    if args.describe:
        print(json.dumps(identity, indent=2))
        return
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    # Worktree bytes are used so local pre-commit validation is possible. CI builds
    # from a clean checkout of the release tag and records the exact source SHA.
    manifest = {**meta, "sourceCommit": commit}
    stem = f"lemmaduck-{meta['id']}-{meta['version']}"
    output = args.output.resolve() if args.output else ROOT / "build" / "release" / distro
    output.mkdir(parents=True, exist_ok=True)
    files = []
    with tempfile.TemporaryDirectory() as temp:
        staging = Path(temp) / stem
        staging.mkdir()
        for relative in tracked:
            if not relative:
                continue
            source = ROOT / relative
            # Base is the complete source checkout. Editor archives contain only
            # their own subtree, flattened so bin/ and init.* remain usable.
            if not source.is_relative_to(source_root):
                continue
            if source.is_symlink():
                raise SystemExit(f"Release cannot include symlink: {relative}")
            if source.is_file():
                target = staging / source.relative_to(source_root)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
        (staging / "distro.json").write_text(json.dumps(meta, indent=2) + "\n")
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
