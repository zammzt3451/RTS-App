import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Schema v2: multiple users. Every personal table carries user_id.
const SCHEMA_V2 = `
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_seen TEXT);
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL, value TEXT, PRIMARY KEY (user_id, key));
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created INTEGER, expires INTEGER);
  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'invite',          -- 'invite' (new account) | 'reset' (new password)
    target_user INTEGER REFERENCES users(id) ON DELETE CASCADE,
    note TEXT, created_by INTEGER, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
    used_by INTEGER, used_at TEXT);
  CREATE TABLE IF NOT EXISTS uploads (
    name TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area TEXT, title TEXT NOT NULL, scene TEXT, origin TEXT, path TEXT, freiling TEXT,
    checks TEXT, status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL, released_at TEXT, is_main INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS checkins (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL, morning TEXT, evening TEXT,
    PRIMARY KEY (user_id, date));
  CREATE TABLE IF NOT EXISTS xp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    at TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, amount INTEGER NOT NULL, label TEXT,
    UNIQUE(user_id, kind, ref));
  CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week TEXT NOT NULL, template TEXT NOT NULL,
    goal_id INTEGER, title TEXT, text TEXT, xp INTEGER,
    status TEXT NOT NULL DEFAULT 'offered', note TEXT, updated_at TEXT,
    UNIQUE(user_id, week, template));
  CREATE TABLE IF NOT EXISTS slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id INTEGER, kind TEXT NOT NULL DEFAULT 'target',
    title TEXT, note TEXT, style TEXT, image TEXT, comfort TEXT DEFAULT 'comfortable',
    arrived_image TEXT, arrived_at TEXT, created_at TEXT NOT NULL, frame TEXT);
  CREATE TABLE IF NOT EXISTS trials (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL, response TEXT, at TEXT,
    PRIMARY KEY (user_id, chapter));
  CREATE TABLE IF NOT EXISTS chronicle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    at TEXT NOT NULL, date TEXT, type TEXT NOT NULL, title TEXT, body TEXT, ref TEXT);
  CREATE INDEX IF NOT EXISTS idx_chronicle_user ON chronicle(user_id, id);
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
  CREATE INDEX IF NOT EXISTS idx_slides_user ON slides(user_id);
  CREATE INDEX IF NOT EXISTS idx_quests_user ON quests(user_id, week);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

// Columns carried over from the single-user (v1) schema.
const V1_COLUMNS = {
  goals: 'id, area, title, scene, origin, path, freiling, checks, status, created_at, released_at, is_main',
  checkins: 'date, morning, evening',
  xp_events: 'id, at, kind, ref, amount, label',
  quests: 'id, week, template, goal_id, title, text, xp, status, note, updated_at',
  slides: 'id, goal_id, kind, title, note, style, image, comfort, arrived_image, arrived_at, created_at, frame',
  trials: 'chapter, response, at',
  chronicle: 'id, at, date, type, title, body, ref',
};
const PER_USER_SETTINGS = ['companionName', 'portraitBase', 'portraits', 'stepZeroDone'];

export function openDb(dataDir, { adminUsername = 'admin', log = console.log } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'rts.sqlite'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const version = db.prepare('PRAGMA user_version').get().user_version;
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name));

  if (version < 2 && tables.has('goals')) migrateV1toV2(db, dataDir, adminUsername, log);
  db.exec(SCHEMA_V2);
  db.exec('PRAGMA user_version = 2');
  return db;
}

// One-time move from the single-user app: existing data becomes the admin account's.
function migrateV1toV2(db, dataDir, adminUsername, log) {
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  if (!cols('goals').includes('is_main')) db.exec('ALTER TABLE goals ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0');
  if (!cols('slides').includes('frame')) db.exec('ALTER TABLE slides ADD COLUMN frame TEXT');

  const backup = path.join(dataDir, `rts-before-multiuser-${Date.now()}.sqlite`);
  db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
  log(`  Backed up the single-user database to ${backup}`);

  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    const pwRow = db.prepare("SELECT value FROM settings WHERE key = 'password'").get();
    for (const t of Object.keys(V1_COLUMNS)) db.exec(`ALTER TABLE ${t} RENAME TO ${t}_v1`);
    db.exec('DROP TABLE IF EXISTS sessions');
    db.exec(SCHEMA_V2);

    if (pwRow) {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO users (id, username, password_hash, is_admin, created_at) VALUES (1, ?, ?, 1, ?)')
        .run(adminUsername, JSON.parse(pwRow.value), now);
      for (const [t, c] of Object.entries(V1_COLUMNS)) db.exec(`INSERT INTO ${t} (${c}, user_id) SELECT ${c}, 1 FROM ${t}_v1`);
      const ins = db.prepare('INSERT OR REPLACE INTO user_settings (user_id, key, value) VALUES (1, ?, ?)');
      for (const k of PER_USER_SETTINGS) {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
        if (row) ins.run(k, row.value);
      }
      const upDir = path.join(dataDir, 'uploads');
      if (fs.existsSync(upDir)) {
        const up = db.prepare('INSERT OR IGNORE INTO uploads (name, user_id, created_at) VALUES (?, 1, ?)');
        for (const f of fs.readdirSync(upDir)) if (/^[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(f)) up.run(f, now);
      }
      log(`  Moved existing data into the admin account "${adminUsername}".`);
    }
    for (const t of Object.keys(V1_COLUMNS)) db.exec(`DROP TABLE ${t}_v1`);
    db.prepare(`DELETE FROM settings WHERE key IN ('password', ${PER_USER_SETTINGS.map(() => '?').join(',')})`).run(...PER_USER_SETTINGS);
    db.exec('PRAGMA user_version = 2');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

export function getUserSetting(db, uid, key, fallback = null) {
  const row = db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').get(uid, key);
  return row ? JSON.parse(row.value) : fallback;
}
export function setUserSetting(db, uid, key, value) {
  db.prepare('INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value')
    .run(uid, key, JSON.stringify(value));
}
