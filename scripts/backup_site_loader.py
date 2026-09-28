"""Import the hyphenated backup command without running its CLI."""
import importlib.util
from pathlib import Path

def load_backup_helpers():
    spec = importlib.util.spec_from_file_location('portfolio_backup', Path(__file__).with_name('backup-site.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
