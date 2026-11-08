"""Compare fixture answers with owner-side truth, independent of the methods."""
import json
from pathlib import Path
import sys

request = json.loads(Path(sys.argv[1]).read_text())
correct = request.get("candidate", {}).get("answer") == request["truth"]["answer"]
Path(sys.argv[2]).write_text(json.dumps({"valid": True, "metrics": {"correctness": int(correct)}, "reason": "Owner-supplied hidden arithmetic answer; harness contract only"}))
