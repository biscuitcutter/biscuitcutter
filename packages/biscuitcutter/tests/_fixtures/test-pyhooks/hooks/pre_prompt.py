"""Simple pre-prompt hook that will fail if a specific env var is set."""

import os
import sys
from pathlib import Path


def backup_configuration(cwd: Path) -> Path:
    """Create a backup of biscuitcutter.json."""
    src_data = (cwd / 'biscuitcutter.json').read_text()
    dst = cwd / '_biscuitcutter.json'
    with open(dst, 'w') as fh:
        fh.write(src_data)
    return dst


def main():
    """Check if we can run the  biscuitcutter."""
    if os.environ.get("COOKIECUTTER_FAIL_PRE_PROMPT", False):
        sys.exit(1)
    cwd = Path('.').resolve()
    bkp = backup_configuration(cwd)
    print(f"All good here, created {bkp}")


if __name__ == "__main__":
    main()
