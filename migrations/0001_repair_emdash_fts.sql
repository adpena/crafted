-- Repair EmDash 0.1.0 external-content FTS5 triggers.
-- Deletes must supply OLD column values; AFTER UPDATE can only read NEW values
-- from the content table. Rebuild derived indexes without changing content rows.
-- https://sqlite.org/fts5.html#external_content_tables

DROP TRIGGER IF EXISTS _emdash_fts_projects_update;
CREATE TRIGGER _emdash_fts_projects_update AFTER UPDATE ON ec_projects BEGIN
  INSERT INTO _emdash_fts_projects(_emdash_fts_projects, rowid, id, locale, title, summary, content) VALUES ('delete', OLD.rowid, OLD.id, OLD.locale, OLD.title, OLD.summary, OLD.content);
  INSERT INTO _emdash_fts_projects(rowid, id, locale, title, summary, content) VALUES (NEW.rowid, NEW.id, NEW.locale, NEW.title, NEW.summary, NEW.content);
END;
DROP TRIGGER IF EXISTS _emdash_fts_projects_delete;
CREATE TRIGGER _emdash_fts_projects_delete AFTER DELETE ON ec_projects BEGIN
  INSERT INTO _emdash_fts_projects(_emdash_fts_projects, rowid, id, locale, title, summary, content) VALUES ('delete', OLD.rowid, OLD.id, OLD.locale, OLD.title, OLD.summary, OLD.content);
END;
INSERT INTO _emdash_fts_projects(_emdash_fts_projects) VALUES ('rebuild');
INSERT INTO _emdash_fts_projects(_emdash_fts_projects, rank) VALUES ('integrity-check', 1);

DROP TRIGGER IF EXISTS _emdash_fts_pages_update;
CREATE TRIGGER _emdash_fts_pages_update AFTER UPDATE ON ec_pages BEGIN
  INSERT INTO _emdash_fts_pages(_emdash_fts_pages, rowid, id, locale, title, content) VALUES ('delete', OLD.rowid, OLD.id, OLD.locale, OLD.title, OLD.content);
  INSERT INTO _emdash_fts_pages(rowid, id, locale, title, content) VALUES (NEW.rowid, NEW.id, NEW.locale, NEW.title, NEW.content);
END;
DROP TRIGGER IF EXISTS _emdash_fts_pages_delete;
CREATE TRIGGER _emdash_fts_pages_delete AFTER DELETE ON ec_pages BEGIN
  INSERT INTO _emdash_fts_pages(_emdash_fts_pages, rowid, id, locale, title, content) VALUES ('delete', OLD.rowid, OLD.id, OLD.locale, OLD.title, OLD.content);
END;
INSERT INTO _emdash_fts_pages(_emdash_fts_pages) VALUES ('rebuild');
INSERT INTO _emdash_fts_pages(_emdash_fts_pages, rank) VALUES ('integrity-check', 1);

DROP TRIGGER IF EXISTS _emdash_fts_writing_update;
CREATE TRIGGER _emdash_fts_writing_update AFTER UPDATE ON ec_writing BEGIN
  INSERT INTO _emdash_fts_writing(_emdash_fts_writing, rowid, id, locale, title, summary, content) VALUES ('delete', OLD.rowid, OLD.id, OLD.locale, OLD.title, OLD.summary, OLD.content);
  INSERT INTO _emdash_fts_writing(rowid, id, locale, title, summary, content) VALUES (NEW.rowid, NEW.id, NEW.locale, NEW.title, NEW.summary, NEW.content);
END;
DROP TRIGGER IF EXISTS _emdash_fts_writing_delete;
CREATE TRIGGER _emdash_fts_writing_delete AFTER DELETE ON ec_writing BEGIN
  INSERT INTO _emdash_fts_writing(_emdash_fts_writing, rowid, id, locale, title, summary, content) VALUES ('delete', OLD.rowid, OLD.id, OLD.locale, OLD.title, OLD.summary, OLD.content);
END;
INSERT INTO _emdash_fts_writing(_emdash_fts_writing) VALUES ('rebuild');
INSERT INTO _emdash_fts_writing(_emdash_fts_writing, rank) VALUES ('integrity-check', 1);
