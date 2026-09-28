#!/usr/bin/env python3
"""Back up D1 without exporting FTS shadow tables; restore and check locally."""
import argparse
import hashlib
import json
import os
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


def query(database, location, sql):
    result = json.loads(run_wrangler(['d1', 'execute', database, location, '--command', sql, '--json']))
    if not result or any(not r.get('success') for r in result):
        raise RuntimeError('D1 query did not succeed')
    return [row for r in result for row in r['results']]


def restoration_sql(schema, data):
    virtual = [r for r in schema if r['type'] == 'table' and r['sql'] and
               r['sql'].upper().startswith('CREATE VIRTUAL TABLE')]
    for r in virtual:
        if 'USING fts5' not in r['sql'] or 'content=' not in r['sql']:
            raise ValueError(f"Unsupported virtual table: {r['name']}")
    excluded = lambda name: name.startswith(('sqlite_', '_cf_')) or any(
        name.startswith(r['name'] + '_') for r in virtual)
    tables = [r for r in schema if r['type'] == 'table' and r not in virtual and not excluded(r['name'])]
    other = [r for r in schema if r['type'] in ('index', 'trigger', 'view') and r['sql'] and
             not excluded(r['name']) and not excluded(r['tbl_name'])]
    sql = ['PRAGMA foreign_keys=OFF;', 'BEGIN;']
    sql += [r['sql'] + ';' for r in tables]
    sql += [data]
    sql += [r['sql'] + ';' for r in virtual]
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
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')
    directory = (args.output or ROOT / 'backups' / stamp).resolve()
    if directory.is_relative_to(ROOT / 'public'):
        raise ValueError('Backups must never be written into public/')
    directory.mkdir(parents=True, exist_ok=False)
    location = '--local' if args.local else '--remote'
    schema_sql = "SELECT name,type,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name"
    schema = query(args.database, location, schema_sql)
    _, tables = restoration_sql(schema, '')
    counts_sql = '; '.join(f"SELECT '{r['name'].replace(chr(39), chr(39)*2)}' AS name, COUNT(*) AS count FROM {quote(r['name'])}" for r in tables)
    before = query(args.database, location, counts_sql)
    source_foreign_keys = query(args.database, location, 'PRAGMA foreign_key_check')
    data_path = directory / 'data.sql'
    command = ['d1', 'export', args.database, location, '--no-schema', '--output', str(data_path)]
    for row in tables:
        command += ['--table', row['name']]
    run_wrangler(command)
    after = query(args.database, location, counts_sql)
    if before != after or schema != query(args.database, location, schema_sql):
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
