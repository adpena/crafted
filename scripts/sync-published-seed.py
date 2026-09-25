#!/usr/bin/env python3
"""Refresh public seed content from an already verified private backup."""
import argparse
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('backup', type=Path)
args = parser.parse_args()
manifest = json.loads((args.backup / 'manifest.json').read_text())
if not manifest['restoreVerified']:
    raise SystemExit('Backup restoration is not verified')
db = sqlite3.connect(args.backup / 'restored.sqlite')
db.row_factory = sqlite3.Row
seed_path = ROOT / 'seed/seed.json'
seed = json.loads(seed_path.read_text())
for collection in ['pages', 'dev', 'design', 'policy', 'writing']:
    fields = db.execute('SELECT f.slug,f.type FROM _emdash_fields f JOIN _emdash_collections c ON f.collection_id=c.id WHERE c.slug=?', (collection,)).fetchall()
    entries = []
    for row in db.execute(f"SELECT * FROM ec_{collection} WHERE status='published' AND deleted_at IS NULL ORDER BY slug"):
        if row['slug'] in ['working-but-uncovered', 'tx-working-but-uncovered']:
            raise SystemExit('Excluded work is published in the source')
        data = {}
        for field in fields:
            value = row[field['slug']]
            if value is not None and field['type'] in ['portableText', 'json', 'image']:
                try: value = json.loads(value)
                except (ValueError,TypeError): pass
            if value is not None: data[field['slug']] = value
        entries.append({'id':row['slug'],'slug':row['slug'],'status':'published','data':data})
    if not entries: raise SystemExit(f'Empty collection: {collection}')
    seed['content'][collection] = entries
seed_path.write_text(json.dumps(seed, ensure_ascii=False, indent=2) + '\n')
print('Updated public seed content; private revisions and user records were not exported.')
