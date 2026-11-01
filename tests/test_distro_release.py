"""Check installable distro boundaries after monorepo packaging."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/build_release.py"


class DistroReleaseTests(unittest.TestCase):
    def test_archives_and_packages_keep_each_distro_usable(self):
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        for distro in ("base", "emacs", "neovim"):
            with self.subTest(distro=distro), tempfile.TemporaryDirectory() as temp:
                directory = ROOT if distro == "base" else ROOT / "distros" / distro
                meta = json.loads((directory / "distro.json").read_text())
                stem = f"lemmaduck-{distro}-{meta['version']}"
                output = Path(temp) / "assets"
                subprocess.run([sys.executable, str(BUILDER), "--distro", distro,
                                "--tag", f"{distro}-v{meta['version']}", "--npm", "--output", str(output)],
                               cwd=ROOT, check=True, capture_output=True, text=True)
                self.assertEqual(len(list(output.iterdir())), 5)
                for line in (output / (stem + ".sha256")).read_text().splitlines():
                    digest, name = line.split("  ")
                    self.assertEqual(hashlib.sha256((output / name).read_bytes()).hexdigest(), digest)
                manifest = json.loads((output / (stem + ".manifest.json")).read_text())
                self.assertEqual(manifest["id"], distro)
                self.assertEqual(manifest["sourceCommit"], commit)
                self.assertEqual(manifest["repository"], "https://github.com/ts06068/lemmaduck")
                with tarfile.open(output / (stem + ".npm.tgz")) as archive:
                    package = json.load(archive.extractfile("package/package.json"))
                    self.assertEqual(package["name"], f"@ts06068/lemmaduck-{distro}")
                    self.assertEqual(package["version"], meta["version"])
                    self.assertIn("package/release-manifest.json", archive.getnames())
                    if distro != "base":
                        self.assertEqual(package["repository"]["directory"], f"distros/{distro}")
                with zipfile.ZipFile(output / (stem + ".zip")) as archive:
                    archive.extractall(Path(temp) / "unpacked")
                unpacked = Path(temp) / "unpacked" / stem
                if distro == "base":
                    self.assertTrue((unpacked / "distros/emacs/init.el").is_file())
                    self.assertTrue((unpacked / "distros/neovim/init.lua").is_file())
                else:
                    self.assertFalse((unpacked / "distros").exists())
                    self.assertFalse((unpacked / "tools").exists())
                    self.assertEqual(manifest["engine"]["testedCommit"], commit)
                    launcher = unpacked / "bin" / f"lemmaduck-{distro}"
                    result = subprocess.run([sys.executable, str(launcher), "--print-command", temp],
                                            check=True, capture_output=True, text=True)
                    command = json.loads(result.stdout)["command"]
                    self.assertIn(str(unpacked / ("init.el" if distro == "emacs" else "init.lua")), command)

    def test_wrong_distro_tag_is_rejected_without_artifacts(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "assets"
            result = subprocess.run([sys.executable, str(BUILDER), "--distro", "emacs",
                                     "--tag", "neovim-v0.1.0-alpha.2", "--output", str(output)],
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
