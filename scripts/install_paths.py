"""User-scoped paths shared by LemmaDuck and its installers."""
from pathlib import Path
import os
import sys

INSTALL_HOME = Path(os.environ.get("LEMMADUCK_INSTALL_HOME") or Path.home()).resolve()
share = INSTALL_HOME / ".local/share"
default_data = share / "lemmaduck"

# A setup marker identifies a LemmaDuck installation even under a custom directory name.
if not default_data.exists() and not os.environ.get("LEMMADUCK_DATA_DIR"):
    marked = [file.parent for file in share.glob("*/lemmaduck-setup.lock")
              if file.is_file() and not file.is_symlink() and not file.parent.is_symlink()
              and file.stat().st_uid == os.getuid()]
    if len(marked) == 1:
        default_data = marked[0]
    elif len(marked) > 1:
        raise ValueError("Multiple LemmaDuck installations found. Select LEMMADUCK_DATA_DIR and LEMMADUCK_STATE_DIR.")

DATA_ROOT = Path(os.environ.get("LEMMADUCK_DATA_DIR") or default_data)
STATE_ROOT = Path(os.environ.get("LEMMADUCK_STATE_DIR") or INSTALL_HOME / ".local/state" / default_data.name)
NVIM_APPNAME = "lemmaduck-nvim"

if __name__ == "__main__":
    print({"data": DATA_ROOT, "state": STATE_ROOT, "editor": NVIM_APPNAME}[sys.argv[1]])
