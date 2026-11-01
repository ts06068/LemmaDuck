"""Install the pinned OMP executable and register its coding profile with Paseo."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.request import Request, urlopen


def install_paseo(target, lockdir, env):
    binary = target / "node_modules/.bin/paseo"
    if os.access(binary, os.X_OK):
        return
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(dir=target.parent) as staging:
        runtime = Path(staging) / "runtime"
        shutil.copytree(lockdir, runtime)
        subprocess.run(["npm", "ci", "--omit=dev", "--no-audit", "--no-fund"], cwd=runtime, env=env, check=True)
        if not os.access(runtime / "node_modules/.bin/paseo", os.X_OK):
            raise ValueError("The locked Paseo installation did not produce an executable.")
        runtime.rename(target)


def install_omp(binary, spec):
    def checksum(path):
        with path.open("rb") as stream:
            return hashlib.file_digest(stream, "sha256").hexdigest()

    if binary.is_file() and checksum(binary) == spec["sha256"]:
        if not os.access(binary, os.X_OK):
            binary.chmod(0o755)
        return
    binary.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(dir=binary.parent) as staging:
        download = Path(staging) / "omp"
        request = Request(spec["url"], headers={"User-Agent": "LemmaDuck-setup"})
        with urlopen(request, timeout=120) as response, download.open("wb") as target:
            shutil.copyfileobj(response, target)
        if checksum(download) != spec["sha256"]:
            raise ValueError("OMP download failed its SHA-256 check. The installed binary was preserved.")
        download.chmod(0o755)
        download.replace(binary)


def configure_paseo(home, launcher, env):
    """Add only our named provider. A preexisting custom command belongs to its owner."""
    path = home / "config.json"
    if path.is_symlink():
        path = path.resolve(strict=True)
    previous = path.read_bytes() if path.exists() else None
    config = json.loads(previous) if previous is not None else {}
    if not isinstance(config, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    agents = config.setdefault("agents", {})
    if not isinstance(agents, dict) or not isinstance(agents.setdefault("providers", {}), dict):
        raise ValueError(f"Expected agents.providers to be an object in {path}")
    providers = agents["providers"]
    entry = {"extends": "omp", "label": "LemmaDuck Code", "enabled": True,
             "command": [str(launcher), "code", "."],
             "env": {key: env[key] for key in ("LEMMADUCK_INSTALL_HOME", "LEMMADUCK_DATA_DIR", "LEMMADUCK_STATE_DIR")}}
    if "lemmaduck-code" in providers:
        if providers["lemmaduck-code"] != entry:
            print(f"Kept the existing lemmaduck-code provider in {path}. Expected command: {entry['command']}")
        return
    providers["lemmaduck-code"] = entry
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(dir=path.parent) as staging:
        draft = Path(staging) / "config.json"
        draft.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n")
        draft.chmod(path.stat().st_mode & 0o777 if path.exists() else 0o600)
        if (path.read_bytes() if path.exists() else None) != previous:
            raise ValueError(f"{path} changed during setup. Rerun setup to merge the provider.")
        draft.replace(path)
    print(f"Registered LemmaDuck Code in {path}. For a running host use 'lemmaduck paseo reload'.")
