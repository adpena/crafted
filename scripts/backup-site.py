#!/usr/bin/env python3
"""Back up D1 without exporting FTS shadow tables; restore and check locally."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import sqlite3
import subprocess
from datetime import datetime, timezone
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def run_wrangler(args):
    # Export output includes a signed download URL. Keep it out of logs.
    result = subprocess.run([str(ROOT / 'node_modules/.bin/wrangler'), *args],
                            cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Wrangler {args[0]} {args[1]} failed; no backup accepted")
    return result.stdout


def query(database, location, sql, persist_to=None):
    persistence = ['--persist-to', str(persist_to)] if persist_to else []
    result = json.loads(run_wrangler(['d1', 'execute', database, location, *persistence, '--command', sql, '--json']))
    if not result or any(not r.get('success') for r in result):
        raise RuntimeError('D1 query did not succeed')
    return [row for r in result for row in r['results']]


def restoration_sql(schema, data):
    virtual = [r for r in schema if r['type'] == 'table' and r['sql'] and
               r['sql'].upper().startswith('CREATE VIRTUAL TABLE')]
    for r in virtual:
        if not re.search(r'\bUSING\s+fts5\b', r['sql'], re.I):
            raise ValueError(f"Unsupported virtual table: {r['name']}")
        if re.search(r"\bcontent\s*=\s*['\"]\s*['\"]", r['sql'], re.I):
            raise ValueError(f"Cannot restore contentless FTS: {r['name']}")
    excluded = lambda name: name.startswith(('sqlite_', '_cf_')) or any(
        name.startswith(r['name'] + '_') for r in virtual)
    tables = [r for r in schema if r['type'] == 'table' and r not in virtual and not excluded(r['name'])]
    other = [r for r in schema if r['type'] in ('index', 'trigger', 'view') and r['sql'] and
             not excluded(r['name']) and not excluded(r['tbl_name'])]
    # EmDash 1 stores extracted prose in FTS instead of mirroring raw JSON.
    # Let its own insert trigger rebuild those values from restored content.
    # This also keeps FTS rowids aligned when an export reassigns base rowids.
    stored = [r for r in virtual if not re.search(r'\bcontent\s*=', r['sql'], re.I)]
    early_triggers = []
    for r in stored:
        base = 'ec_' + r['name'].removeprefix('_emdash_fts_')
        triggers = [t for t in schema if t['type'] == 'trigger' and
                    t['name'] == r['name'] + '_insert' and t['tbl_name'] == base and
                    re.search(r'\bAFTER\s+INSERT\b', t['sql'], re.I)]
        if not r['name'].startswith('_emdash_fts_') or len(triggers) != 1:
            raise ValueError(f"Missing EmDash FTS insert trigger: {r['name']}")
        early_triggers += triggers
    # FTS triggers share the virtual table prefix; shadow-table exclusion must
    # not remove the triggers that keep a restored index up to date.
    fts_triggers = [r for r in schema if r['type'] == 'trigger' and r['sql'] and
                    any(r['name'] == v['name'] + suffix for v in virtual
                        for suffix in ('_insert', '_update', '_delete'))]
    other = [r for r in other if r not in early_triggers]
    other += [r for r in fts_triggers if r not in early_triggers and r not in other]
    sql = ['PRAGMA foreign_keys=OFF;', 'BEGIN;']
    sql += [r['sql'] + ';' for r in tables]
    sql += [r['sql'] + ';' for r in stored]
    sql += [r['sql'] + ';' for r in early_triggers]
    sql += [data]
    sql += [r['sql'] + ';' for r in virtual if r not in stored]
    sql += [r['sql'] + ';' for r in other]
    for r in virtual:
        name = quote(r['name'])
        sql += [f"INSERT INTO {name}({name}) VALUES ('rebuild');",
                f"INSERT INTO {name}({name}, rank) VALUES ('integrity-check', 1);"]
    sql += ['COMMIT;', 'PRAGMA foreign_keys=ON;']
    return '\n'.join(sql), tables


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', default='crafted')
    parser.add_argument('--local', action='store_true')
    parser.add_argument('--persist-to', type=Path, help='Isolated state directory; requires --local')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.persist_to and not args.local:
        parser.error('--persist-to requires --local')
    os.umask(0o077)
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')
    directory = (args.output or ROOT / 'backups' / stamp).resolve()
    if directory.is_relative_to(ROOT / 'public'):
        raise ValueError('Backups must never be written into public/')
    directory.mkdir(parents=True, exist_ok=False)
    location = '--local' if args.local else '--remote'
    read = lambda sql: query(args.database, location, sql, args.persist_to)
    schema_sql = "SELECT name,type,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name"
    schema = read(schema_sql)
    _, tables = restoration_sql(schema, '')
    counts_sql = '; '.join(f"SELECT '{r['name'].replace(chr(39), chr(39)*2)}' AS name, COUNT(*) AS count FROM {quote(r['name'])}" for r in tables)
    before = read(counts_sql)
    source_foreign_keys = read('PRAGMA foreign_key_check')
    data_path = directory / 'data.sql'
    command = ['d1', 'export', args.database, location, '--no-schema', '--output', str(data_path)]
    for row in tables:
        command += ['--table', row['name']]
    if args.persist_to:
        # Wrangler export has no --persist-to option. Read the selected local
        # state explicitly instead of accidentally exporting its default DB.
        statements = []
        for table in tables:
            name = quote(table['name'])
            columns = read(f'PRAGMA table_info({name})')
            values = " || ',' || ".join(f'quote({quote(c["name"])})' for c in columns)
            prefix = (f'INSERT INTO {name} VALUES (').replace("'", "''")
            statements.append(f"SELECT '{prefix}' || {values} || ');' AS statement FROM {name}")
        rows = read(';\n'.join(statements))
        data_path.write_text('\n'.join(r['statement'] for r in rows))
    else:
        run_wrangler(command)
    after = read(counts_sql)
    if before != after or schema != read(schema_sql):
        raise RuntimeError('Database changed during backup; retry while editing is paused')
    sql, _ = restoration_sql(schema, data_path.read_text())
    restore_path = directory / 'restore.sql'
    restore_path.write_text(sql)
    d1_sql = sql.replace('PRAGMA foreign_keys=OFF;\nBEGIN;', 'PRAGMA defer_foreign_keys=TRUE;').replace('COMMIT;\nPRAGMA foreign_keys=ON;', '')
    (directory / 'restore-d1.sql').write_text(d1_sql)
    (directory / 'schema.json').write_text(json.dumps(schema, indent=2) + '\n')
    restored = directory / 'restored.sqlite'
    db = sqlite3.connect(restored)
    try:
        db.executescript(sql)
        if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise RuntimeError('Restored database failed integrity check')
        for row in before:
            actual = db.execute(f"SELECT COUNT(*) FROM {quote(row['name'])}").fetchone()[0]
            if actual != row['count']:
                raise RuntimeError(f"Restored row count mismatch: {row['name']}")
        violations = db.execute('PRAGMA foreign_key_check').fetchall()
        # SQL exports may assign new rowids. Compare the affected relationships;
        # retain and report pre-existing orphans instead of silently deleting them.
        source_violations = Counter((r['table'], r['parent'], r['fkid']) for r in source_foreign_keys)
        restored_violations = Counter((table, parent, fkid) for table, _, parent, fkid in violations)
        if restored_violations != source_violations:
            raise RuntimeError('Restoration changed foreign key violations')
        media = db.execute('SELECT id,storage_key,size FROM media ORDER BY id').fetchall()
        media_dir = directory / 'media'
        media_dir.mkdir()
        for media_id, key, size in media:
            if args.local:
                raise RuntimeError('Local media requires a separate local R2 backup')
            destination = media_dir / media_id
            run_wrangler(['r2', 'object', 'get', f'crafted-media/{key}', '--remote', '--file', str(destination)])
            if size is not None and destination.stat().st_size != size:
                raise RuntimeError(f'Media size mismatch: {media_id}')
        manifest = {
            'createdAt': stamp, 'database': args.database, 'location': location,
            'schema': 'schema.json', 'restore': 'restore.sql', 'tables': before,
            'd1Restore': 'restore-d1.sql',
            'restoreSha256': hashlib.sha256(restore_path.read_bytes()).hexdigest(),
            'restoreVerified': True, 'media': [
                {'id': mid, 'storageKey': key, 'sha256': hashlib.sha256((media_dir / mid).read_bytes()).hexdigest()}
                for mid, key, _ in media],
            'preExistingForeignKeyViolations': source_foreign_keys,
            'scope': 'Application tables and CMS-referenced R2 media; FTS rebuilt. Does not include unreferenced R2 objects, KV, Worker secrets, or an atomic snapshot of concurrent writes.'
        }
        (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        print(f'Backup restored and verified: {directory} ({len(tables)} tables, {len(media)} media objects)')
    finally:
        db.close()


if __name__ == '__main__':
    main()
