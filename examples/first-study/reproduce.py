"""Recompute a synthetic paper claim and track the exact inputs and outputs."""
import argparse
import csv
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile

PROJECT = Path(__file__).resolve().parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def calculate():
    source = (PROJECT / "observations.csv").read_bytes()
    draft = (PROJECT / "draft.md").read_bytes()
    data = list(csv.DictReader(io.StringIO(source.decode("utf-8"))))
    if not data or len({row["sample_id"] for row in data}) != len(data):
        raise ValueError("Supply at least one observation with a unique sample ID.")
    values = [Decimal(row["value"]) for row in data]
    if not all(v.is_finite() for v in values):
        raise ValueError("All measurements must be finite.")
    matches = re.findall(r"mean value of ([+-]?\d+(?:\.\d+)?) units", draft.decode())
    if len(matches) != 1:
        raise ValueError("Expected exactly one 'mean value of NUMBER units' claim.")
    claimed = Decimal(matches[0])
    mean = sum(values, Decimal(0)) / Decimal(len(values))
    decision = "supported" if claimed == mean else "discrepancy"
    summary = f"n,mean,units\n{len(values)},{mean},units\n".encode()
    note = (f"# Claim C01\n\nThe draft reports {claimed} units. The mean is {mean} units "
            f"across {len(values)} observations. Decision: **{decision}**.\n\n"
            f"Source: `observations.csv`, rows 2–{len(values) + 1}. "
            "Computed value: `results/summary.csv`, cell B2.\n").encode()
    outputs = {"summary.csv": summary, "claim.md": note}
    manifest = {"schema": 1, "claim_id": "C01", "decision": decision,
                "input_sha256": {"observations.csv": digest(source), "draft.md": digest(draft),
                                 "reproduce.py": digest(Path(__file__).read_bytes())},
                "output_sha256": {name: digest(body) for name, body in outputs.items()}}
    outputs["manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    return outputs, mean, len(values), decision


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs, mean, n, decision = calculate()
    root = PROJECT / "results"
    if args.check:
        for name, body in outputs.items():
            path = root / name
            if not path.is_file() or path.read_bytes() != body:
                raise SystemExit(f"Missing or stale: {path}. Rerun reproduce.py.")
    else:
        root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=root) as staging:
            for name, body in outputs.items():
                (Path(staging) / name).write_bytes(body)
            for name in outputs:
                (Path(staging) / name).replace(root / name)
    print(f"C01: {decision}; n={n}, mean={mean}. {'Verified' if args.check else 'Wrote'} results/manifest.json")


if __name__ == "__main__":
    main()
