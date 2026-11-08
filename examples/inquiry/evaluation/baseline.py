"""Deterministic fixture adapter, not an AI-scientist baseline."""
import json
from pathlib import Path
import sys

request = json.loads(Path(sys.argv[1]).read_text())
Path(sys.argv[2]).write_text(json.dumps({"answer": sum(request["input"]["values"]), "uncertainty": "Exact arithmetic fixture"}))
