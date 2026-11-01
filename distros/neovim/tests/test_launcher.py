import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
META = json.loads((ROOT / "distro.json").read_text())
LAUNCHER = ROOT / "bin" / ("lemmaduck-" + META["id"])

class LaunchTests(unittest.TestCase):
    def test_paths_with_shell_characters_are_arguments(self):
        with tempfile.TemporaryDirectory(prefix="duck space ;$") as project:
            result = subprocess.run([sys.executable, str(LAUNCHER), "--print-command", project], check=True, text=True, capture_output=True)
            data = json.loads(result.stdout)
            self.assertEqual(data["cwd"], str(Path(project).resolve()))
            self.assertEqual(data["environment"]["LEMMADUCK_PROJECT"], data["cwd"])
            self.assertIsInstance(data["command"], list)
            if META["id"] == "neovim":
                self.assertEqual(data["environment"]["NVIM_APPNAME"], "lemmaduck-neovim")
            else:
                self.assertIn("-Q", data["command"])
    def test_missing_project_fails_before_editor(self):
        result = subprocess.run([sys.executable, str(LAUNCHER), "/no-such-lemmaduck-project"], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
    def test_editor_receives_cwd_and_environment(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            fake = directory / "fake-editor"
            fake.write_text("#!/usr/bin/env python3\nimport json,os,sys\nprint(json.dumps({'args':sys.argv[1:],'cwd':os.getcwd(),'project':os.environ['LEMMADUCK_PROJECT']}))\n")
            fake.chmod(0o755)
            result = subprocess.run([sys.executable, str(LAUNCHER), tmp, "--", "--test-flag"], env={**os.environ, "LEMMADUCK_EDITOR":str(fake), "XDG_STATE_HOME":str(directory / "state")}, check=True, capture_output=True, text=True)
            data = json.loads(result.stdout)
            self.assertEqual(data["cwd"], str(directory.resolve()))
            self.assertEqual(data["project"], data["cwd"])
            self.assertEqual(data["args"][-1], "--test-flag")
    def test_doctor_reports_missing_program(self):
        result = subprocess.run([sys.executable, str(LAUNCHER), "--doctor"], env={**os.environ,"LEMMADUCK_EDITOR":"missing-editor-7f47"}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIsNone(json.loads(result.stdout)["editor"])

if __name__ == "__main__":
    unittest.main()
