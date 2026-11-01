import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import launcher


class PackagedSetupTests(unittest.TestCase):
    def test_published_package_does_not_reinstall_dependencies_or_compile(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "package.json").write_text(json.dumps({"name": "@ts06068/lemmaduck-base"}))
            core = root / "dist/cli.js"
            core.parent.mkdir()
            core.write_text("// already built")
            with patch.object(launcher, "ROOT", root), patch.object(launcher, "CORE", core), patch.object(launcher, "run") as run:
                launcher.prepare_core({})
                run.assert_not_called()
                self.assertFalse((root / "node_modules").exists())

    def test_incomplete_package_fails_instead_of_attempting_a_source_build(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "package.json").write_text(json.dumps({"name": "@ts06068/lemmaduck-base"}))
            with patch.object(launcher, "ROOT", root), patch.object(launcher, "CORE", root / "dist/cli.js"), patch.object(launcher, "run") as run:
                with self.assertRaisesRegex(ValueError, "Reinstall"):
                    launcher.prepare_core({})
                run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
