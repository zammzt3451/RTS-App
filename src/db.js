import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'rts.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, created INTEGER, expires INTEGER);
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT, title TEXT NOT NULL, scene TEXT, origin TEXT, path TEXT, freiling TEXT,
      checks TEXT, status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL, released_at TEXT);
    CREATE TABLE IF NOT EXISTS checkins (
      date TEXT PRIMARY KEY, morning TEXT, evening TEXT);
    CREATE TABLE IF NOT EXISTS xp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, kind TEXT NOT NULL,
      ref TEXT NOT NULL, amount INTEGER NOT NULL, label TEXT,
      UNIQUE(kind, ref));
    CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, week TEXT NOT NULL, template TEXT NOT NULL,
      goal_id INTEGER, title TEXT, text TEXT, xp INTEGER,
      status TEXT NOT NULL DEFAULT 'offered', note TEXT, updated_at TEXT,
      UNIQUE(week, template));
    CREATE TABLE IF NOT EXISTS slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER, kind TEXT NOT NULL DEFAULT 'target',
      title TEXT, note TEXT, style TEXT, image TEXT, comfort TEXT DEFAULT 'comfortable',
      arrived_image TEXT, arrived_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS trials (chapter INTEGER PRIMARY KEY, response TEXT, at TEXT);
    CREATE TABLE IF NOT EXISTS chronicle (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, date TEXT, type TEXT NOT NULL,
      title TEXT, body TEXT, ref TEXT);
  `);
  // Additive migrations (safe to run every start).
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  if (!cols('goals').includes('is_main')) db.exec('ALTER TABLE goals ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0');
  if (!cols('slides').includes('frame')) db.exec('ALTER TABLE slides ADD COLUMN frame TEXT');
  return db;
}

export function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}
export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}
