#!/usr/bin/env python3
"""Create an isolated local D1 preview from the public seed; never writes remote D1."""
import argparse
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from backup_site_loader import load_backup_helpers

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--state', type=Path, default=ROOT / '.portfolio-release/test-state')
args = parser.parse_args()
state = args.state.resolve()
if state.exists(): raise SystemExit(f'Refusing to overwrite existing preview state: {state}')
state.mkdir(parents=True)
with tempfile.TemporaryDirectory(prefix='portfolio-seed-') as tmp:
    database = Path(tmp) / 'seed.sqlite'
    for command in [['init', '--database', str(database)], ['seed', 'seed/seed.json', '--database', str(database)]]:
        subprocess.run([str(ROOT / 'node_modules/.bin/emdash'), *command], cwd=ROOT, check=True)
    db = sqlite3.connect(database)
    db.row_factory = sqlite3.Row
    schema = [dict(r) for r in db.execute("SELECT name,type,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name")]
    helper = load_backup_helpers()
    _, tables = helper.restoration_sql(schema, '')
    statements = []
    for table in tables:
        name = helper.quote(table['name'])
        columns = [r['name'] for r in db.execute(f'PRAGMA table_info({name})')]
        values = db.execute('SELECT '+','.join(f'quote({helper.quote(c)})' for c in columns)+f' FROM {name}')
        statements += [f"INSERT INTO {name} VALUES ({','.join(row)});" for row in values]
    sql, _ = helper.restoration_sql(schema, '\n'.join(statements))
    # D1 manages the import transaction itself.
    sql = sql.replace('PRAGMA foreign_keys=OFF;\nBEGIN;', 'PRAGMA defer_foreign_keys=TRUE;').replace('COMMIT;\nPRAGMA foreign_keys=ON;', '')
    export = Path(tmp) / 'seed.sql'
    export.write_text(sql)
    subprocess.run([str(ROOT / 'node_modules/.bin/wrangler'), 'd1', 'execute', 'crafted', '--local', '--persist-to', str(state), '--file', str(export)], cwd=ROOT, check=True)
print(f'Preview seeded. Run with PORTFOLIO_TEST_STATE={state}')
