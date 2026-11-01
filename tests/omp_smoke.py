"""Check the pinned OMP protocols inside CI's loopback-only network namespace."""
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
interfaces = {line.split(":")[0].strip() for line in Path("/proc/net/dev").read_text().splitlines()[2:]}
if interfaces != {"lo"}:
    raise SystemExit("Run this test in a network namespace containing only loopback.")


def check_protocol(binary, mode):
    with tempfile.TemporaryDirectory(prefix="lemmaduck-omp-test-") as tmp:
        root = Path(tmp)
        project = root / "project"
        project.mkdir()
        (project / ".lemmaduck-kind").write_text("development\n")
        (root / "data/bin").mkdir(parents=True)
        (root / "data/bin/omp").symlink_to(binary)
        env = {"PATH": os.environ["PATH"], "HOME": str(root), "TERM": "dumb",
               "LEMMADUCK_INSTALL_HOME": str(root), "LEMMADUCK_DATA_DIR": str(root / "data"),
               "LEMMADUCK_STATE_DIR": str(root / "state")}
        config = root / "model.json"
        config.write_text(json.dumps({"id": "duck-local", "label": "Synthetic fixture", "billing": "local",
                                     "api": "openai-completions", "baseUrl": "http://127.0.0.1:9/v1",
                                     "models": [{"id": "fixture", "contextWindow": 32000, "maxTokens": 1024}]}))
        subprocess.run([str(ROOT / "lemmaduck"), "providers", "add", str(config)], env=env, capture_output=True, check=True)
        proc = subprocess.Popen([str(ROOT / "lemmaduck"), "agent", str(project), "--mode", mode,
                                 "--model", "duck-local/fixture"], env=env, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
        events = queue.Queue()

        def read(stream, kind):
            for line in stream:
                events.put((kind, line.rstrip()))

        for stream, kind in ((proc.stdout, "out"), (proc.stderr, "err")):
            threading.Thread(target=read, args=(stream, kind), daemon=True).start()
        try:
            pending = {"get_state", "get_available_commands"}
            for command in sorted(pending):
                proc.stdin.write(json.dumps({"id": command, "type": command}) + "\n")
            proc.stdin.flush()
            deadline = time.monotonic() + 45
            while pending and time.monotonic() < deadline:
                try:
                    kind, line = events.get(timeout=1)
                except queue.Empty:
                    if proc.poll() is not None:
                        raise AssertionError(f"OMP exited with {proc.returncode}")
                    continue
                if kind == "err":
                    print(mode, line[:400], file=sys.stderr)
                    continue
                try:
                    value = json.loads(line)
                except ValueError:
                    continue
                if value.get("id") in pending:
                    assert value.get("success"), value
                    if value["id"] == "get_state":
                        state = value["data"]
                        assert state["model"]["provider"] == "duck-local"
                        assert state["messageCount"] == 0 and state["sessionId"]
                    pending.remove(value["id"])
            assert not pending, f"OMP timed out waiting for {pending}"
            print(f"OMP {mode} selected the registered fixture and returned state and commands.")
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, 9)
                proc.wait()


for protocol in ("rpc", "rpc-ui"):
    check_protocol(Path(sys.argv[1]).resolve(strict=True), protocol)
