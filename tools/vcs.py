"""Install the pinned Jujutsu executable without changing any repository."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import tarfile
import tempfile
from urllib.request import Request, urlopen


def install_jj(binary, spec):
    record = binary.with_suffix(".install.json")
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    if binary.is_file() and record.is_file():
        saved = json.loads(record.read_text())
        if saved.get("archive") == spec["sha256"] and saved.get("binary") == digest(binary):
            binary.chmod(0o755)
            return
    binary.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(dir=binary.parent) as staging:
        archive = Path(staging) / "jj.tar.gz"
        with urlopen(Request(spec["url"], headers={"User-Agent": "LemmaDuck-setup"}), timeout=60) as response, archive.open("wb") as target:
            shutil.copyfileobj(response, target)
        if digest(archive) != spec["sha256"]:
            raise ValueError("Jujutsu archive failed its SHA-256 check. The installed binary was preserved.")
        staged = Path(staging) / "jj"
        with tarfile.open(archive) as tar:
            members = [entry for entry in tar.getmembers() if entry.isfile() and PurePosixPath(entry.name).name == "jj"]
            if len(members) != 1:
                raise ValueError("Expected one Jujutsu binary in the pinned archive.")
            with tar.extractfile(members[0]) as source, staged.open("wb") as target:
                shutil.copyfileobj(source, target)
        receipt = Path(staging) / "install.json"
        receipt.write_text(json.dumps({"archive": spec["sha256"], "binary": digest(staged)}) + "\n")
        staged.chmod(0o755)
        staged.replace(binary)
        receipt.replace(record)
