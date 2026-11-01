#!/usr/bin/env python3
"""Exercise real global npm installs/upgrades in an isolated prefix, without accounts."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run(argv, env):
    result = subprocess.run([str(arg) for arg in argv], env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300)
    if result.returncode:
        raise RuntimeError(f"Command failed: {argv}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--previous", type=Path, required=True)
    args = parser.parse_args()
    old = sorted(args.previous.glob("*.npm.tgz"))
    current = []
    versions = {}
    for distro in ("base", "emacs", "neovim"):
        directory = ROOT if distro == "base" else ROOT / "distros" / distro
        meta = json.loads((directory / "distro.json").read_text())
        versions[distro] = meta["version"]
        current.append(ROOT / "build/release" / distro / f"lemmaduck-{distro}-{meta['version']}.npm.tgz")
    if len(old) != 3 or not all(path.is_file() for path in current):
        raise SystemExit("Provide all three prior packages and build all three current packages first")
    with tempfile.TemporaryDirectory(prefix="lemmaduck-npm-") as temp:
        directory = Path(temp)
        prefix, user = directory / "npm", directory / "user"
        state = user / "state"
        state.mkdir(parents=True)
        marker = state / "existing-task.txt"
        marker.write_text("Keep my task across package updates\n")
        project = directory / "project with spaces"
        project.mkdir()
        env = {**os.environ, "PATH": str(prefix / "bin") + os.pathsep + os.environ["PATH"],
               "LEMMADUCK_INSTALL_HOME": str(user), "LEMMADUCK_DATA_DIR": str(user / "data"),
               "LEMMADUCK_STATE_DIR": str(state), "XDG_STATE_HOME": str(state)}
        install = ["npm", "install", "--global", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund"]
        run([*install, *old], env)
        for path in old:
            with tarfile.open(path) as archive:
                package = json.load(archive.extractfile("package/package.json"))
            executable = "lemmaduck" if package["lemmaduckDistro"] == "base" else "lemmaduck-" + package["lemmaduckDistro"]
            assert run([prefix / "bin" / executable, "--version"], env).strip().endswith(package["version"])
        owned_launcher = user / ".local/bin/lemmaduck"
        owned_launcher.parent.mkdir(parents=True)
        owned_launcher.symlink_to(prefix / "bin/lemmaduck")
        run([*install, *current], env)
        for distro, version in versions.items():
            for command in ("duck", "lemmaduck"):
                executable = command if distro == "base" else command + "-" + distro
                assert run([prefix / "bin" / executable, "--version"], env).strip().endswith(version)
        setup = run([prefix / "bin/duck", "setup"], env)
        assert "Using the compiled worker" in setup
        assert "npm ci" not in setup and "tsc" not in setup
        assert run([prefix / "bin/duck", "routing", "show"], env) == run([prefix / "bin/lemmaduck", "routing", "show"], env)
        assert owned_launcher.resolve() == (prefix / "bin/lemmaduck").resolve()
        assert (user / ".local/bin/duck").resolve() == (prefix / "bin/duck").resolve()
        run([user / ".local/bin/duck", "init", directory / "new study", "--kind", "research"], env)
        assert (directory / "new study" / "protocol.md").is_file()
        assert (directory / "new study" / "claims.tsv").is_file()
        fake_editor = directory / "fake-editor"
        fake_editor.write_text("#!/usr/bin/env python3\nimport json,os,sys\nprint(json.dumps({'args':sys.argv[1:],'cwd':os.getcwd(),'project':os.environ['LEMMADUCK_PROJECT']}))\n")
        fake_editor.chmod(0o755)
        for distro in ("emacs", "neovim"):
            editor_env = {**env, "LEMMADUCK_EDITOR": str(fake_editor)}
            data = json.loads(run([prefix / "bin" / ("duck-" + distro), project], editor_env))
            assert data["cwd"] == str(project) and data["project"] == str(project)
            doctor = json.loads(run([prefix / "bin" / ("duck-" + distro), "--doctor"], editor_env))
            assert Path(doctor["engine"]).resolve() == (prefix / "bin/lemmaduck").resolve()
        assert marker.read_text() == "Keep my task across package updates\n"
    print("Verified global npm upgrade: duck and legacy commands work, editor arguments are preserved, and task state is unchanged.")


if __name__ == "__main__":
    main()
