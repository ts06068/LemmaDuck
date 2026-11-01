"""Bootstrap the managed worker and open a project in the current terminal."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile

import workflow_sources

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from install_paths import DATA_ROOT, INSTALL_HOME, STATE_ROOT

SOURCES = json.loads((ROOT / "locks/upstreams.json").read_text())["workflow_sources"]
CACHE = Path(os.environ.get("LEMMADUCK_WORKFLOWS_DIR", DATA_ROOT / "workflow-sources"))
CORE = ROOT / "dist/cli.js"
CORE_COMMANDS = {"agent", "login", "billing", "providers", "status", "context", "reconcile", "open", "ui", "connector"}
DESCRIPTION = """Run LemmaDuck in a Herdr terminal on your Linux host.
Agent commands: agent [PROJECT], login PROVIDER, billing confirm PROVIDER --extra-usage-off,
providers list, status [PROJECT], connector list|tools|call ... . Run 'agent' in a project terminal."""


def spec_dir(spec):
    return CACHE / spec["name"] / spec["commit"]


def run(args, **kwargs):
    subprocess.run([str(a) for a in args], check=True, **kwargs)


def runtime_env():
    env = {**os.environ, "LEMMADUCK_INSTALL_HOME": str(INSTALL_HOME),
           "LEMMADUCK_DATA_DIR": str(DATA_ROOT), "LEMMADUCK_STATE_DIR": str(STATE_ROOT)}
    env["PATH"] = str(DATA_ROOT / "bin") + os.pathsep + env.get("PATH", "")
    return env


def node_ready(env):
    exe = shutil.which("node", path=env["PATH"])
    if not exe or not shutil.which("npm", path=env["PATH"]):
        return False
    version = subprocess.check_output([exe, "--version"], text=True).strip()
    match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", version)
    return bool(match and tuple(map(int, match.groups())) >= (22, 19, 0))


def build_fingerprint(env):
    digest = hashlib.sha256(subprocess.check_output(["node", "--version"], env=env))
    for file in [ROOT / n for n in ("package.json", "npm-shrinkwrap.json", "tsconfig.json")] + sorted((ROOT / "src").rglob("*.ts")):
        digest.update(str(file.relative_to(ROOT)).encode() + b"\0" + file.read_bytes() + b"\0")
    return digest.hexdigest()


def install_source(spec):
    target = spec_dir(spec)
    if target.exists():
        count = workflow_sources.verify(target, spec)
    else:
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with tempfile.TemporaryDirectory(dir=target.parent, prefix=".fetch-") as temp:
            staging = Path(temp) / "source"
            count = workflow_sources.fetch(staging, spec)
            staging.rename(target)
    print(f"{spec['name']} {spec['version']}: verified {count} paths", flush=True)


def setup(args):
    steps = ["Check Linux x86_64, Git, Python 3.12+ and Node 22.19+",
             "Install the locked npm dependencies and build the Pi worker"]
    if args.full:
        steps += ["Verify the Google Antigravity ACP runtime",
                  "Fetch and verify every pinned pstack and gstack file"]
    launcher = INSTALL_HOME / ".local/bin/lemmaduck"
    steps += [f"Link the launcher at {launcher}"]
    for i, step in enumerate(steps, 1):
        print(f"{i}. {step}", flush=True)
    if args.dry_run:
        return
    if platform.system() != "Linux" or platform.machine().lower() not in ("x86_64", "amd64"):
        raise ValueError("Run setup on an x86_64 Linux host or in x64 WSL2 Ubuntu. Connect to that host from Herdr.")
    if sys.version_info < (3, 12) or not shutil.which("git"):
        raise ValueError("Install Python 3.12 or newer and Git on the execution host.")
    if os.path.lexists(launcher) and launcher.resolve() != ROOT / "lemmaduck":
        raise ValueError(f"Another installation owns {launcher}. Relocate it or run the existing checkout's setup.")
    import fcntl
    DATA_ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (DATA_ROOT / "lemmaduck-setup.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ValueError("Another LemmaDuck setup is running on this host.") from exc
        env = runtime_env()
        if not node_ready(env):
            run([sys.executable, ROOT / "scripts/bootstrap-tools.py", "--node-only"], env=env)
        stamp = ROOT / "node_modules/.lemmaduck-build"
        fingerprint = build_fingerprint(env)
        if not (CORE.is_file() and stamp.is_file() and stamp.read_text().strip() == fingerprint):
            run(["npm", "ci", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund"], cwd=ROOT, env=env)
            run(["npm", "run", "build"], cwd=ROOT, env=env)
            stamp.write_text(fingerprint + "\n")
        if args.full:
            run([sys.executable, ROOT / "scripts/install-google.py"], env=env)
            for spec in SOURCES.values():
                install_source(spec)
        launcher.parent.mkdir(parents=True, exist_ok=True)
        if not launcher.is_symlink():
            launcher.symlink_to(ROOT / "lemmaduck")
    print(f"Ready. Run {launcher} doctor. Account sign-in is a separate step.")


def workflow_rows():
    with (ROOT / "catalog/workflow-routing.tsv").open(encoding="utf-8", newline="") as stream:
        return [r for r in csv.DictReader(stream, delimiter="\t") if r["kind"] != "test-fixture"]


def workflow(args):
    rows = workflow_rows()
    if args.operation == "list":
        for row in rows:
            if args.key is None or row["source"] == args.key:
                print(f"{row['source']}:{row['entry']}\t{row['kind']}\t{row['upstream_path']}")
        return
    source, sep, entry = (args.key or "").partition(":")
    if not sep or source not in SOURCES:
        raise ValueError("Use a locked workflow name such as pstack:sharpen.")
    spec = SOURCES[source]
    matching = [r for r in rows if r["source"] == source and entry in (r["entry"], r["upstream_path"])]
    if len(matching) > 1:
        raise ValueError("Use the full upstream path after the colon: " + ", ".join(r["upstream_path"] for r in matching))
    path = matching[0]["upstream_path"] if matching else entry
    inv = workflow_sources.inventory(spec)
    if path not in inv or inv[path][0] not in ("100644", "100755") or Path(path).suffix.lower() not in (".md", ".mdc", ".txt"):
        raise ValueError("Unknown workflow or reference. Use 'workflow list' to see the entry points.")
    target = spec_dir(spec)
    if not target.is_dir():
        raise ValueError(f"{source} is missing. Run 'lemmaduck setup --full' on the execution host.")
    _, oid, size = inv[path]
    doc = workflow_sources.git(target, "cat-file", "blob", oid)
    if len(doc) != size or hashlib.sha1(f"blob {size}\0".encode() + doc).hexdigest() != oid:
        raise ValueError("Workflow bytes differ from the locked blob.")
    content = doc.decode("utf-8")
    if args.json:
        print(json.dumps({"name": args.key, "commit": spec["commit"], "path": path, "blob": oid, "content": content}))
    else:
        print(content, end="" if content.endswith("\n") else "\n")


def doctor(args):
    if args.providers:
        return core(["doctor", "--agent-only"])
    env = runtime_env()
    node_ok = node_ready(env)
    git_ok = shutil.which("git")
    ready = bool(git_ok and node_ok and CORE.is_file() and platform.system() == "Linux"
                 and platform.machine().lower() in ("x86_64", "amd64") and sys.version_info >= (3, 12))
    print(f"Host: {platform.system()} {platform.machine()} | Python {platform.python_version()}")
    print("Git:", git_ok or "missing")
    print("Node/npm:", "ready" if node_ok else "missing or too old")
    print("Pi worker:", "built" if CORE.is_file() else "run lemmaduck setup --full")
    for spec in SOURCES.values():
        path = spec_dir(spec)
        state = "missing"
        if path.is_dir():
            count = workflow_sources.verify(path, spec)
            state = f"verified {count} files"
        else:
            ready = False
        print(f"{spec['name']} {spec['version']}: {state}")
    print("Account sign-in and external integrations are checked separately.")
    return 0 if ready else 1


def init_project(args):
    dest = args.directory.expanduser().absolute()
    src = ROOT / ("examples/first-study" if args.kind == "demo" else "templates/" + args.kind)
    if dest.exists() or dest.is_symlink():
        raise ValueError("Choose a new directory. Existing projects can be opened directly with 'lemmaduck agent PATH'.")
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"), dirs_exist_ok=False)
    print(f"Created {args.kind} project at {dest}")


def core(argv):
    if not CORE.is_file():
        raise ValueError("The worker has not been built. Run 'lemmaduck setup --full' in this checkout.")
    env = runtime_env()
    if not node_ready(env):
        raise ValueError("Node 22.19+ and npm are required on the execution host.")
    os.execvpe("node", ["node", str(CORE), *argv], env)


def main():
    argv = sys.argv[1:]
    try:
        if argv and argv[0] in CORE_COMMANDS:
            return core(argv)
        parser = argparse.ArgumentParser(description=DESCRIPTION, formatter_class=argparse.RawDescriptionHelpFormatter)
        parser.add_argument("--version", action="version", version=json.loads((ROOT / "package.json").read_text())["version"])
        sub = parser.add_subparsers(dest="command", required=True)
        p = sub.add_parser("setup", help="Build the worker and install its launcher")
        p.add_argument("--full", action="store_true", help="Also install the full workflow sources and Google worker")
        p.add_argument("--dry-run", action="store_true")
        p.set_defaults(handler=setup)
        p = sub.add_parser("doctor", help="Inspect this host and verify installed workflow sources")
        p.add_argument("--providers", action="store_true")
        p.set_defaults(handler=doctor)
        p = sub.add_parser("workflow", help="List entry points or read a pinned workflow")
        p.add_argument("operation", choices=("list", "show"))
        p.add_argument("key", nargs="?")
        p.add_argument("--json", action="store_true")
        p.set_defaults(handler=workflow)
        p = sub.add_parser("init", help="Create a new starter project")
        p.add_argument("directory", type=Path)
        p.add_argument("--kind", choices=("demo", "research", "development", "writing", "assistant"), default="research")
        p.set_defaults(handler=init_project)
        args = parser.parse_args(argv)
        return args.handler(args) or 0
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"LemmaDuck: {exc}", file=sys.stderr)
        return 1
