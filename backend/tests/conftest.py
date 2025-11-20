"""Pytest configuration for backend tests."""

import sys
from pathlib import Path

# Ensure the backend package (app) is importable when running pytest from repo root.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
