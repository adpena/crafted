#!/usr/bin/env python3
"""Check portfolio content and credentials across the EmDash 0.x to 1.x upgrade.

Only equivalent UTC date formatting is allowed in the content. New core tables
and columns are outside this comparison; SQLite integrity/FKs are checked too.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3

TABLES = ['ec_pages', 'ec_dev', 'ec_design', 'ec_policy', 'ec_writing', 'ec_projects',
          'revisions', 'options', 'users', 'credentials', 'auth_tokens', 'oauth_accounts',
          'allowed_domains', 'media', '_emdash_api_tokens', '_emdash_oauth_tokens',
          '_emdash_oauth_clients', '_plugin_storage', '_plugin_indexes', '_portfolio_legacy_metadata']


def utc_date(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def compatible_value(table, column, before, after, row):
    if before == after:
        return True
    dates = {'ec_policy': {'date'}, 'ec_writing': {'created_at', 'published_at'}}
    if column in dates.get(table, set()) and isinstance(before, str):
        return utc_date(before) == after
    if table == 'revisions' and column == 'data':
        old, new = json.loads(before), json.loads(after)
        if row['collection'] == 'policy' and isinstance(old.get('date'), str):
            old['date'] = utc_date(old['date'])
        return old == new
    return False


def verify(before_path, after_path):
    before = sqlite3.connect(f'file:{Path(before_path).resolve()}?mode=ro', uri=True)
    after = sqlite3.connect(f'file:{Path(after_path).resolve()}?mode=ro', uri=True)
    before.row_factory = after.row_factory = sqlite3.Row
    report = {}
    try:
        assert after.execute('PRAGMA integrity_check').fetchone()[0] == 'ok', 'Database integrity failed'
        assert not after.execute('PRAGMA foreign_key_check').fetchall(), 'Foreign key violations'
        for table in TABLES:
            old = [dict(r) for r in before.execute(f'SELECT * FROM "{table}"')]
            new = [dict(r) for r in after.execute(f'SELECT * FROM "{table}"')]
            if table == 'options':
                key = 'name'
            else:
                pk = sorted((r for r in before.execute(f'PRAGMA table_info("{table}")') if r['pk']), key=lambda r: r['pk'])
                key = None
            keys = [key] if key else [r['name'] for r in pk]
            assert keys, f'{table}: missing primary key'
            identity = lambda row: tuple(row[k] for k in keys)
            index = {identity(row): row for row in new}
            old_keys = {identity(row) for row in old}
            if table == 'options':
                assert set(index) - old_keys <= {('byline_fields_version',), ('emdash:seed_complete',)}, 'Unexpected settings added'
            else:
                assert set(index) == old_keys, f'{table}: row identities changed'
            changes = 0
            for row in old:
                assert identity(row) in index, f'{table}: missing row'
                updated = index[identity(row)]
                for column, value in row.items():
                    assert column in updated, f'{table}: missing column {column}'
                    assert compatible_value(table, column, value, updated[column], row), f'{table}: changed {column}'
                    changes += value != updated[column]
            report[table] = {'preservedRows': len(old), 'normalizedDateCells': changes}
        return report
    finally:
        before.close()
        after.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before', type=Path)
    parser.add_argument('after', type=Path)
    args = parser.parse_args()
    print(json.dumps(verify(args.before, args.after), indent=2))
