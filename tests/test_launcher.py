import argparse
from contextlib import redirect_stdout
import csv
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import launcher


class LauncherTest(unittest.TestCase):
    def test_reproduce_and_detect_stale_results(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "study"
            args = argparse.Namespace(kind="demo", directory=dest)
            with redirect_stdout(io.StringIO()):
                launcher.init_project(args)
            command = [sys.executable, str(dest / "reproduce.py")]
            self.assertIn("n=3, mean=20", subprocess.check_output(command, text=True))
            subprocess.run(command + ["--check"], check=True, capture_output=True)
            with self.assertRaises(ValueError):
                launcher.init_project(args)
            f = dest / "observations.csv"
            f.write_text(f.read_text().replace("D-03,30", "D-03,24"))
            self.assertNotEqual(subprocess.run(command + ["--check"], capture_output=True).returncode, 0)

    def test_full_inventory_counts_and_discovery(self):
        for name, count in (("pstack", 1137), ("gstack", 4528)):
            self.assertEqual(len(launcher.workflow_sources.inventory(launcher.SOURCES[name])), count)
        entries = launcher.workflow_rows()
        self.assertIn(("pstack", "sharpen"), {(r["source"], r["entry"]) for r in entries})
        self.assertFalse(any(r["kind"] == "test-fixture" for r in entries))

    def test_reads_pinned_content_even_when_worktree_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / "demo" / ("a" * 40)
            folder.mkdir(parents=True)
            subprocess.run(["git", "-C", str(folder), "init", "-q"], check=True)
            doc = b"Original workflow.\n"
            oid = subprocess.check_output(["git", "-C", str(folder), "hash-object", "-w", "--stdin"], input=doc).decode().strip()
            (folder / "guide.md").write_text("Local change")
            inv = root / "lock.tsv"
            with inv.open("w") as file:
                writer = csv.writer(file, delimiter="\t")
                writer.writerow(["path", "mode", "git_blob_sha1", "bytes"])
                writer.writerow(["guide.md", "100644", oid, len(doc)])
            spec = {"name": "demo", "commit": "a"*40, "inventory": str(inv), "entries": 1}
            row = {"source": "demo", "entry": "guide", "upstream_path": "guide.md"}
            with patch.object(launcher, "CACHE", root), patch.object(launcher, "SOURCES", {"demo": spec}), patch.object(launcher, "workflow_rows", return_value=[row]):
                out = io.StringIO()
                with redirect_stdout(out):
                    launcher.workflow(argparse.Namespace(operation="show", key="demo:guide", json=True))
                self.assertEqual(json.loads(out.getvalue())["content"].encode(), doc)
                with self.assertRaises(ValueError):
                    launcher.workflow(argparse.Namespace(operation="show", key="demo:../config", json=False))


if __name__ == "__main__":
    unittest.main()
