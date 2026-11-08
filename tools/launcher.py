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
from coding import configure_paseo, install_omp, install_paseo
from vcs import install_jj

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from install_paths import DATA_ROOT, INSTALL_HOME, STATE_ROOT

SOURCES = json.loads((ROOT / "locks/upstreams.json").read_text())["workflow_sources"]
CACHE = Path(os.environ.get("LEMMADUCK_WORKFLOWS_DIR", DATA_ROOT / "workflow-sources"))
CORE = ROOT / "dist/cli.js"
OMP = next(tool for tool in json.loads((ROOT / "locks/tools.json").read_text())["tools"] if tool.get("name") == "omp")
JJ = next(tool for tool in json.loads((ROOT / "locks/tools.json").read_text())["tools"] if tool.get("name") == "jj")
PASEO_LOCK = ROOT / "locks/paseo"
PASEO_RUNTIME = DATA_ROOT / "tools" / ("paseo-" + hashlib.sha256((PASEO_LOCK / "package-lock.json").read_bytes()).hexdigest()[:16])
PASEO = PASEO_RUNTIME / "node_modules/.bin/paseo"
CORE_COMMANDS = {"research", "agent", "code", "login", "billing", "providers", "status", "context", "reconcile", "open", "ui", "connector", "routing", "vcs"}
DESCRIPTION = """Use Paseo to open your Linux host. Run 'agent PROJECT' for a project or
'code PROJECT' for an OMP coding session. 'agent PROJECT --pi' opens the research worker.
Other commands: login PROVIDER, billing confirm PROVIDER --extra-usage-off,
providers list, routing show|init|path, vcs PROJECT status|diff|log,
status [PROJECT], connector list|add|discover|allow|tools|call ... ."""


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


def packaged_install():
    """Published npm packages already contain a compiled, versioned worker."""
    package = json.loads((ROOT / "package.json").read_text())
    return package.get("name") == "@ts06068/lemmaduck-base"


def prepare_core(env):
    if packaged_install():
        if not CORE.is_file():
            raise ValueError("The npm package is missing its compiled worker. Reinstall @ts06068/lemmaduck-base.")
        print("Using the compiled worker and dependencies installed by npm.", flush=True)
        return
    stamp = ROOT / "node_modules/.lemmaduck-build"
    fingerprint = build_fingerprint(env)
    if not (CORE.is_file() and stamp.is_file() and stamp.read_text().strip() == fingerprint):
        run(["npm", "ci", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund"], cwd=ROOT, env=env)
        run(["npm", "run", "build"], cwd=ROOT, env=env)
        stamp.write_text(fingerprint + "\n")


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
             "Use the compiled worker installed by npm" if packaged_install()
             else "Install the locked npm dependencies and build the Pi worker"]
    if args.full:
        steps += [f"Install the locked Paseo host, OMP {OMP['version']} and Jujutsu {JJ['version']}; register LemmaDuck Code",
                  "Verify the Google Antigravity ACP runtime",
                  "Fetch and verify every pinned pstack and gstack file"]
    launchers = {INSTALL_HOME / ".local/bin" / name: ROOT / name for name in ("duck", "lemmaduck")}
    launcher = INSTALL_HOME / ".local/bin/duck"
    steps += [f"Link the launcher at {path}" for path in launchers]
    for i, step in enumerate(steps, 1):
        print(f"{i}. {step}", flush=True)
    if args.dry_run:
        return
    if platform.system() != "Linux" or platform.machine().lower() not in ("x86_64", "amd64"):
        raise ValueError("Run setup on an x86_64 Linux host or in x64 WSL2 Ubuntu. Connect to that host from Paseo.")
    if sys.version_info < (3, 12) or not shutil.which("git"):
        raise ValueError("Install Python 3.12 or newer and Git on the execution host.")
    for path, target in launchers.items():
        if os.path.lexists(path) and path.resolve() != target:
            raise ValueError(f"Another installation owns {path}. Relocate it or run the existing checkout's setup.")
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
        prepare_core(env)
        if args.full:
            install_paseo(PASEO_RUNTIME, PASEO_LOCK, env)
            install_omp(DATA_ROOT / "bin/omp", OMP)
            install_jj(DATA_ROOT / "bin/jj", JJ)
            run([sys.executable, ROOT / "scripts/install-google.py"], env=env)
            for spec in SOURCES.values():
                install_source(spec)
        launcher.parent.mkdir(parents=True, exist_ok=True)
        for path, target in launchers.items():
            if not path.is_symlink():
                path.symlink_to(target)
        if args.full:
            configure_paseo(Path(os.environ.get("PASEO_HOME") or INSTALL_HOME / ".paseo"), launcher, env)
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
        raise ValueError(f"{source} is missing. Run 'duck setup --full' on the execution host.")
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
    paseo_ok = os.access(PASEO, os.X_OK)
    print("Paseo host:", "installed" if paseo_ok else "missing; run duck setup --full")
    print("Pi worker:", "built" if CORE.is_file() else "run duck setup --full")
    omp_ok = os.access(DATA_ROOT / "bin/omp", os.X_OK)
    print("OMP coding worker:", str(DATA_ROOT / "bin/omp") if omp_ok else "missing; run duck setup --full")
    ready = ready and omp_ok and paseo_ok
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
    src = ROOT / ("examples/first-study" if args.kind == "demo" else "examples/inquiry" if args.kind == "inquiry" else "examples/observational-medicine" if args.kind == "observational" else "templates/" + args.kind)
    if dest.exists() or dest.is_symlink():
        raise ValueError("Choose a new directory. Existing projects can be opened directly with 'duck agent PATH'.")
    dest.parent.mkdir(parents=True, exist_ok=True)
    ignored = ["__pycache__", "*.pyc", ".venv", "venv", "node_modules", ".git", ".jj", ".env", ".env.*", "auth.json", "credentials*.json"]
    if args.kind == "observational":
        ignored.extend(["nhefs.csv", "runtime.json"])
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns(*ignored), dirs_exist_ok=False)
    print(f"Created {args.kind} project at {dest}")


def core(argv):
    if not CORE.is_file():
        raise ValueError("The worker has not been built. Run 'duck setup --full' in this checkout.")
    env = runtime_env()
    if not node_ready(env):
        raise ValueError("Node 22.19+ and npm are required on the execution host.")
    os.execvpe("node", ["node", str(CORE), *argv], env)


def main():
    argv = sys.argv[1:]
    try:
        if argv and argv[0] == "paseo":
            if not os.access(PASEO, os.X_OK):
                raise ValueError("Run duck setup --full to install the Paseo host.")
            env = runtime_env()
            env.setdefault("PASEO_HOME", str(INSTALL_HOME / ".paseo"))
            os.execve(PASEO, [str(PASEO), *argv[1:]], env)
        if argv and argv[0] in CORE_COMMANDS:
            return core(argv)
        parser = argparse.ArgumentParser(description=DESCRIPTION, formatter_class=argparse.RawDescriptionHelpFormatter)
        parser.add_argument("--version", action="version", version=json.loads((ROOT / "package.json").read_text())["version"])
        sub = parser.add_subparsers(dest="command", required=True)
        p = sub.add_parser("setup", help="Build the worker and install its launcher")
        p.add_argument("--full", action="store_true", help="Also install OMP, its Paseo profile, pinned workflow sources and Google worker")
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
        p.add_argument("--kind", choices=("demo", "inquiry", "observational", "research", "development", "writing", "assistant"), default="research")
        p.set_defaults(handler=init_project)
        args = parser.parse_args(argv)
        return args.handler(args) or 0
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"LemmaDuck: {exc}", file=sys.stderr)
        return 1
