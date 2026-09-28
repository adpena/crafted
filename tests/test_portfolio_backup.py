"""Exercise restoration and metadata repair against real SQLite/FTS5."""
import importlib.util
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('portfolio_backup', ROOT / 'scripts/backup-site.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
upgrade_spec = importlib.util.spec_from_file_location('emdash_upgrade', ROOT / 'scripts/verify-emdash-upgrade.py')
upgrade = importlib.util.module_from_spec(upgrade_spec)
upgrade_spec.loader.exec_module(upgrade)


class BackupTests(unittest.TestCase):
    def test_upgrade_allows_only_equivalent_date_formatting(self):
        self.assertTrue(upgrade.compatible_value('ec_policy', 'date', '2024-06-27', '2024-06-27T00:00:00.000Z', {}))
        self.assertFalse(upgrade.compatible_value('ec_policy', 'date', '2024-06-27', '2024-06-28T00:00:00.000Z', {}))
        self.assertFalse(upgrade.compatible_value('ec_dev', 'draft_revision_id', 'protected', None, {}))
        self.assertFalse(upgrade.compatible_value('revisions', 'data', '{"content":"original"}', '{"content":"changed"}', {'collection':'dev'}))

    def test_restore_rebuilds_search_without_copying_shadow_tables(self):
        source = sqlite3.connect(':memory:')
        source.row_factory = sqlite3.Row
        source.executescript("""
          CREATE TABLE entries(id TEXT PRIMARY KEY, title TEXT);
          CREATE VIRTUAL TABLE search USING fts5(title,content='entries',content_rowid='rowid');
          CREATE INDEX title_index ON entries(title);
          CREATE TRIGGER add_search AFTER INSERT ON entries BEGIN
            INSERT INTO search(rowid,title) VALUES(NEW.rowid,NEW.title); END;
          CREATE VIEW titles AS SELECT title FROM entries;
        """)
        schema = [dict(r) for r in source.execute('SELECT name,type,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL')]
        # A non-contiguous original rowid must be rebuilt from restored content.
        sql, tables = backup.restoration_sql(schema, "INSERT INTO entries VALUES('a','educator pay');")
        self.assertEqual([t['name'] for t in tables], ['entries'])
        restored = sqlite3.connect(':memory:')
        restored.executescript(sql)
        self.assertEqual(restored.execute("SELECT title FROM search WHERE search MATCH 'educator'").fetchall(), [('educator pay',)])
        restored.execute("INSERT INTO entries VALUES('b','school funding')")
        self.assertEqual(restored.execute("SELECT title FROM search WHERE search MATCH 'funding'").fetchall(), [('school funding',)])
        self.assertEqual(restored.execute('SELECT COUNT(*) FROM titles').fetchone()[0], 2)
        self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        restored.close(); source.close()

    def test_unknown_virtual_tables_fail_closed(self):
        with self.assertRaises(ValueError):
            backup.restoration_sql([{'name':'coordinates','type':'table','tbl_name':'coordinates','sql':'CREATE VIRTUAL TABLE coordinates USING rtree(id,min,max)'}], '')

    def test_stored_fts_rebuilds_extracted_prose_and_keeps_triggers(self):
        source = sqlite3.connect(':memory:')
        source.row_factory = sqlite3.Row
        source.executescript('''
          CREATE TABLE ec_posts(id TEXT PRIMARY KEY, body TEXT, deleted_at TEXT);
          CREATE VIRTUAL TABLE _emdash_fts_posts USING fts5(id UNINDEXED, body);
          CREATE TRIGGER _emdash_fts_posts_insert AFTER INSERT ON ec_posts
          WHEN NEW.deleted_at IS NULL BEGIN
            INSERT INTO _emdash_fts_posts(rowid,id,body)
            VALUES(NEW.rowid,NEW.id,json_extract(NEW.body,'$.text')); END;
          CREATE TRIGGER _emdash_fts_posts_delete AFTER DELETE ON ec_posts BEGIN
            DELETE FROM _emdash_fts_posts WHERE rowid=OLD.rowid; END;
        ''')
        schema = [dict(r) for r in source.execute('SELECT name,type,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL')]
        data = '''INSERT INTO ec_posts VALUES('p','{"text":"educator pay"}',NULL);
                  INSERT INTO ec_posts VALUES('deleted','{"text":"hidden"}','2026');'''
        sql, tables = backup.restoration_sql(schema, data)
        self.assertEqual([t['name'] for t in tables], ['ec_posts'])
        restored = sqlite3.connect(':memory:')
        restored.executescript(sql)
        self.assertEqual(restored.execute("SELECT body FROM _emdash_fts_posts WHERE _emdash_fts_posts MATCH 'educator'").fetchall(), [('educator pay',)])
        self.assertEqual(restored.execute('SELECT COUNT(*) FROM _emdash_fts_posts').fetchone()[0], 1)
        restored.execute("DELETE FROM ec_posts WHERE id='p'")
        self.assertEqual(restored.execute('SELECT COUNT(*) FROM _emdash_fts_posts').fetchone()[0], 0)
        restored.close(); source.close()

    def test_archive_preserves_data_and_removes_only_named_orphans(self):
        db = sqlite3.connect(':memory:')
        fields = 'id collection_id slug label type column_type required unique default_value validation widget options sort_order created_at searchable translatable'.split()
        menu = 'id menu_id parent_id sort_order type reference_collection reference_id custom_url label title_attr target css_classes created_at'.split()
        for table, columns, parent, reference in [('_emdash_fields', fields, '_emdash_collections', 'collection_id'), ('_emdash_menu_items', menu, '_emdash_menus', 'menu_id')]:
            db.execute(f'CREATE TABLE {parent}(id TEXT PRIMARY KEY)')
            db.execute(f'CREATE TABLE {table}(' + ','.join(backup.quote(c)+' TEXT' for c in columns) + f',FOREIGN KEY({reference}) REFERENCES {parent}(id))')
            db.execute(f"INSERT INTO {parent} VALUES('retained-parent')")
        orphan='01KN5VX628558J9QPN3YDX6H79'
        healthy='01KN5VX6294VHMQNH57REBW7XP'
        db.execute('INSERT INTO _emdash_fields(id,collection_id,label) VALUES(?,?,?)', (orphan,'missing',"Old user's field"))
        db.execute('INSERT INTO _emdash_fields(id,collection_id) VALUES(?,?)', (healthy,'retained-parent'))
        db.execute("INSERT INTO _emdash_fields(id,collection_id) VALUES('unlisted-orphan','missing')")
        db.execute("INSERT INTO _emdash_menu_items(id,menu_id,label) VALUES('01KN5Z8S39FAF94B5477XCZ5NC','missing','Old menu')")
        db.executescript("""
          CREATE TABLE ec_design(id,locale,title,summary,content);
          CREATE VIRTUAL TABLE _emdash_fts_design USING fts5(id,locale,title,summary,content,content='ec_design',content_rowid='rowid');
          INSERT INTO ec_design VALUES('design','en','Original','Summary','oldterm');
          CREATE TABLE revisions(id,content); INSERT INTO revisions VALUES('protected','Unpublished draft');
        """)
        sql = (ROOT / 'migrations/0002_archive_legacy_metadata.sql').read_text()
        for _ in range(2): db.executescript(sql)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM _portfolio_legacy_metadata').fetchone()[0], 2)
        self.assertEqual(db.execute("SELECT json_extract(data,'$.label') FROM _portfolio_legacy_metadata WHERE source_id=?", (orphan,)).fetchone()[0], "Old user's field")
        self.assertEqual({r[0] for r in db.execute('SELECT id FROM _emdash_fields')}, {healthy, 'unlisted-orphan'})
        self.assertEqual(db.execute('SELECT * FROM revisions').fetchall(), [('protected','Unpublished draft')])
        db.execute("UPDATE ec_design SET content='newterm'")
        self.assertEqual(db.execute("SELECT id FROM _emdash_fts_design WHERE _emdash_fts_design MATCH 'oldterm'").fetchall(), [])
        self.assertEqual(db.execute("SELECT id FROM _emdash_fts_design WHERE _emdash_fts_design MATCH 'newterm'").fetchall(), [('design',)])
        db.execute('DELETE FROM ec_design')
        db.execute("INSERT INTO _emdash_fts_design(_emdash_fts_design,rank) VALUES('integrity-check',1)")
        db.close()


if __name__ == '__main__': unittest.main()
