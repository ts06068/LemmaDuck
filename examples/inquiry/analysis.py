"""Adapter contract: request.json output.json; prints no private source data."""
import json
from pathlib import Path
import sys
from method import normalize

request = json.loads(Path(sys.argv[1]).read_text())
data = json.loads(Path(next(iter(request["inputs"].values()))).read_text())
rows = data["rows"]
raw = sum(abs(row["measured"] - row["reference"]) for row in rows) / len(rows)
corrected = sum(abs(normalize(row["measured"], data["unit_scale"]) - row["reference"]) for row in rows) / len(rows)
Path(sys.argv[2]).write_text(json.dumps({"error_reduction": raw - corrected, "raw_mae": raw, "corrected_mae": corrected}))
print("Computed paired absolute errors using the registered normalization method.")
