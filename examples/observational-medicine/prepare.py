"""Fetch the pinned public teaching data and attest the locked local environment."""
import argparse
import csv
import hashlib
import importlib.metadata
import io
import json
from pathlib import Path
import platform
import re
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
URL = "https://miguelhernan.org/s/nhefs.csv"
DATA_SHA = "6726827bfcebf7324d786211a517d0515532c2405cc71c5a1fab68d7116ea16c"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-file", type=Path, help="Use an already downloaded copy; the same pinned checksum is required")
    args = parser.parse_args()
    lock = (ROOT / "requirements.lock").read_bytes()
    required = dict(re.findall(r"^([A-Za-z0-9_-]+)==([^\\\s]+)", lock.decode(), flags=re.M))
    versions = {name: importlib.metadata.version(name) for name in required}
    if versions != required:
        raise SystemExit("Install the exact requirements.lock before preparing this study")
    if args.from_file:
        data = args.from_file.read_bytes()
        resolved = str(args.from_file.resolve())
    else:
        with urlopen(Request(URL, headers={"User-Agent": "LemmaDuck-public-study"}), timeout=60) as response:
            data, resolved = response.read(), response.url
    if hashlib.sha256(data).hexdigest() != DATA_SHA:
        raise SystemExit("Public source checksum changed; review the source instead of silently updating the study")
    rows = list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))
    if len(rows) != 1629 or len({row["seqn"] for row in rows}) != len(rows):
        raise SystemExit("Unexpected teaching-cohort denominator or duplicate participant")
    target = ROOT / "nhefs.csv"
    if target.exists() and target.read_bytes() != data:
        raise SystemExit("Refusing to overwrite a different local dataset")
    target.write_bytes(data)
    runtime = {"version": 1, "python": str(Path(sys.executable).absolute()), "python_version": platform.python_version(),
               "packages": versions, "requirements_sha256": hashlib.sha256(lock).hexdigest(),
               "source_url": URL, "resolved_source": resolved, "data_sha256": DATA_SHA, "rows": len(rows)}
    (ROOT / "runtime.json").write_text(json.dumps(runtime, indent=2) + "\n")
    print(json.dumps({"rows": len(rows), "data_sha256": DATA_SHA, "python": runtime["python"], "packages": versions}, indent=2))


if __name__ == "__main__":
    main()
