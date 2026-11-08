"""Independent Decimal calculation; does not import the proposed method."""
from decimal import Decimal
import json
from pathlib import Path
import sys

request = json.loads(Path(sys.argv[1]).read_text())
data = json.loads(Path(next(iter(request["inputs"].values()))).read_text(), parse_float=Decimal)
rows = data["rows"]
scale = Decimal(str(data["unit_scale"]))
valid = bool(rows) and scale > 0
metrics = {}
if valid:
    original = Decimal(0)
    converted = Decimal(0)
    for row in rows:
        measured = Decimal(str(row["measured"]))
        reference = Decimal(str(row["reference"]))
        original += abs(measured - reference)
        converted += abs(measured / scale - reference)
    metrics = {"error_reduction": float((original - converted) / len(rows))}
    candidate = request.get("candidate", {}).get("error_reduction")
    valid = isinstance(candidate, (int, float)) and abs(candidate - metrics["error_reduction"]) < 1e-9
Path(sys.argv[2]).write_text(json.dumps({"valid": valid, "metrics": metrics, "reason": "Independent Decimal calculation over the frozen synthetic rows; no clinical inference"}))
print("Verified unit-normalization error reduction independently.")
