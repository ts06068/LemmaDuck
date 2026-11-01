from contextlib import redirect_stdout
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from coding import configure_paseo, install_omp
import launcher
import argparse


class CodingTest(unittest.TestCase):
    def test_provider_merge_preserves_existing_configuration_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(io.StringIO()):
            home = Path(tmp)
            path = home / "config.json"
            original = {"daemon": {"listen": "127.0.0.1:9999"}, "agents": {"providers": {"custom": {"command": "my-agent"}}}}
            path.write_text(json.dumps(original))
            env = {key: str(home / key) for key in ("LEMMADUCK_INSTALL_HOME", "LEMMADUCK_DATA_DIR", "LEMMADUCK_STATE_DIR")}
            configure_paseo(home, home / "lemmaduck", env)
            config = json.loads(path.read_text())
            self.assertEqual(config["daemon"], original["daemon"])
            self.assertEqual(config["agents"]["providers"]["custom"], original["agents"]["providers"]["custom"])
            entry = config["agents"]["providers"]["lemmaduck-code"]
            self.assertEqual(entry["extends"], "omp")
            self.assertEqual(entry["command"], [str(home / "lemmaduck"), "code", "."])
            before = path.stat().st_mtime_ns
            configure_paseo(home, home / "lemmaduck", env)
            self.assertEqual(path.stat().st_mtime_ns, before)
            configure_paseo(home, home / "different-installation", env)
            self.assertEqual(path.stat().st_mtime_ns, before)

    def test_failed_download_keeps_installed_omp_and_valid_binary_skips_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            binary = Path(tmp) / "omp"
            binary.write_bytes(b"old binary")
            spec = {"url": "https://github.com/example/release", "sha256": hashlib.sha256(b"new binary").hexdigest()}
            with patch("coding.urlopen", return_value=io.BytesIO(b"damaged download")):
                with self.assertRaisesRegex(ValueError, "SHA-256"):
                    install_omp(binary, spec)
            self.assertEqual(binary.read_bytes(), b"old binary")
            binary.write_bytes(b"new binary")
            with patch("coding.urlopen", side_effect=AssertionError("Unexpected network access")):
                install_omp(binary, spec)
            self.assertTrue(os.access(binary, os.X_OK))

    def test_only_development_template_selects_omp(self):
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(io.StringIO()):
            for kind in ("development", "research", "writing", "assistant", "demo"):
                project = Path(tmp) / kind
                launcher.init_project(argparse.Namespace(kind=kind, directory=project))
                self.assertEqual((project / ".lemmaduck-kind").exists(), kind == "development")


if __name__ == "__main__":
    unittest.main()
