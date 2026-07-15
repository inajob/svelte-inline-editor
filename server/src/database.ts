import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PageInfo } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;

export function initDatabase(dataDir?: string): Database.Database {
  const dbPath = dataDir || path.join(__dirname, '..', 'data', 'wiki.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      title TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doc_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_title TEXT NOT NULL,
      update_data BLOB NOT NULL,
      client_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_title) REFERENCES pages(title) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_updates_page ON doc_updates(page_title);

    CREATE TABLE IF NOT EXISTS page_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_title TEXT NOT NULL,
      target_title TEXT NOT NULL,
      FOREIGN KEY (source_title) REFERENCES pages(title) ON DELETE CASCADE,
      FOREIGN KEY (target_title) REFERENCES pages(title) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_links_source ON page_links(source_title);
    CREATE INDEX IF NOT EXISTS idx_links_target ON page_links(target_title);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function upsertPage(title: string): PageInfo {
  const existing = db.prepare('SELECT * FROM pages WHERE title = ?').get(title);
  if (existing) {
    db.prepare('UPDATE pages SET updated_at = CURRENT_TIMESTAMP WHERE title = ?').run(title);
  } else {
    db.prepare('INSERT INTO pages (title) VALUES (?)').run(title);
  }
  return getPage(title)!;
}

export function getPage(title: string): PageInfo | null {
  const row = db.prepare('SELECT * FROM pages WHERE title = ?').get(title) as {
    title: string;
    created_at: string;
    updated_at: string;
  } | undefined;
  if (!row) return null;
  return {
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listPages(): PageInfo[] {
  const rows = db.prepare('SELECT * FROM pages ORDER BY updated_at DESC').all() as {
    title: string;
    created_at: string;
    updated_at: string;
  }[];
  return rows.map((row) => ({
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function deletePage(title: string): boolean {
  const result = db.prepare('DELETE FROM pages WHERE title = ?').run(title);
  return result.changes > 0;
}

export function renamePage(oldTitle: string, newTitle: string): boolean {
  const existing = db.prepare('SELECT * FROM pages WHERE title = ?').get(newTitle);
  if (existing) return false;

  const transaction = db.transaction(() => {
    db.prepare('UPDATE pages SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE title = ?').run(
      newTitle,
      oldTitle
    );
    db.prepare('UPDATE doc_updates SET page_title = ? WHERE page_title = ?').run(newTitle, oldTitle);
    db.prepare('UPDATE page_links SET source_title = ? WHERE source_title = ?').run(
      newTitle,
      oldTitle
    );
    db.prepare('UPDATE page_links SET target_title = ? WHERE target_title = ?').run(
      newTitle,
      oldTitle
    );
  });

  transaction();
  return true;
}

export function storeUpdate(pageTitle: string, updateData: Uint8Array, clientId?: number): void {
  db.prepare('INSERT INTO doc_updates (page_title, update_data, client_id) VALUES (?, ?, ?)').run(
    pageTitle,
    Buffer.from(updateData),
    clientId ?? null
  );
}

export function getUpdates(pageTitle: string): Uint8Array[] {
  const rows = db.prepare('SELECT update_data FROM doc_updates WHERE page_title = ? ORDER BY id ASC').all(
    pageTitle
  ) as { update_data: Buffer }[];
  return rows.map((row) => new Uint8Array(row.update_data));
}

export function clearUpdates(pageTitle: string): void {
  db.prepare('DELETE FROM doc_updates WHERE page_title = ?').run(pageTitle);
}

export function updatePageLinks(pageTitle: string, links: string[]): void {
  db.prepare('DELETE FROM page_links WHERE source_title = ?').run(pageTitle);
  const insert = db.prepare('INSERT INTO page_links (source_title, target_title) VALUES (?, ?)');
  for (const target of links) {
    insert.run(pageTitle, target);
  }
}

export function getBacklinks(pageTitle: string): PageInfo[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT p.title, p.created_at, p.updated_at
       FROM page_links pl
       JOIN pages p ON p.title = pl.source_title
       WHERE pl.target_title = ?`
    )
    .all(pageTitle) as { title: string; created_at: string; updated_at: string }[];
  return rows.map((row) => ({
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
