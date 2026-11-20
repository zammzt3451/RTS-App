// RTS-App — a Reality Transurfing practice journal for a small circle of people.
// Zero npm dependencies: Node's built-in http, crypto and sqlite only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, getUserSetting, setUserSetting } from './db.js';
import { LEVELS, levelFor, XP } from './levels.js';
import { pickQuests } from './quests.js';
import { BOOK_TITLE, PROLOGUE, CHAPTERS } from './tale.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PORT = Number(process.env.PORT || 3000);
const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const SESSION_DAYS = 30;
const INVITE_DAYS = 7;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = openDb(DATA_DIR, { adminUsername: process.env.ADMIN_USERNAME || 'admin' });

const userCount = () => db.prepare('SELECT COUNT(*) c FROM users').get().c;

// ---------- first-run setup code ----------
let SETUP_CODE = process.env.SETUP_CODE || null;
if (!userCount() && !SETUP_CODE) {
  SETUP_CODE = crypto.randomBytes(6).toString('hex');
  console.log(`\n  ✨ First run. Your one-time setup code is: ${SETUP_CODE}\n`);
}

// ---------- helpers ----------
const nowIso = () => new Date().toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));
function verifyPassword(pw, stored) {
  const [, saltHex, hashHex] = (stored || DUMMY_HASH).split('$');
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, 'hex');
  return !!stored && expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/i;
function checkUsername(u) {
  if (!USERNAME_RE.test(u)) return 'Usernames are 3–32 letters, numbers, dots, dashes or underscores.';
  return null;
}
function checkPassword(p) { return typeof p === 'string' && p.length >= 10 && p.length <= 200 ? null : 'Use at least 10 characters.'; }

// Human-friendly one-time codes, e.g. K7QM-3XPA-W9TD (no 0/O/1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const bytes = crypto.randomBytes(12);
  let c = '';
  for (let i = 0; i < 12; i++) c += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length] + (i % 4 === 3 && i < 11 ? '-' : '');
  return c;
}
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const codeHash = (c) => sha256('rts-code:' + normCode(c));

function utcDate() { return new Date().toISOString().slice(0, 10); }
function localDate(req) {
  const d = String(req.headers['x-local-date'] || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const diff = Math.abs(Date.parse(d + 'T12:00:00Z') - Date.now());
    if (diff < 3 * 86400000) return d;
  }
  return utcDate();
}
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)); }
const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max).trim() : '');

// ---------- per-user practice ----------
function totalXp(uid) { return db.prepare('SELECT COALESCE(SUM(amount),0) t FROM xp_events WHERE user_id = ?').get(uid).t; }

function chronicle(uid, type, title, body = '', ref = null, date = null) {
  if (ref) {
    const existing = db.prepare('SELECT id FROM chronicle WHERE user_id = ? AND type = ? AND ref = ?').get(uid, type, ref);
    if (existing) {
      db.prepare('UPDATE chronicle SET title = ?, body = ? WHERE id = ?').run(title, body, existing.id);
      return;
    }
  }
  db.prepare('INSERT INTO chronicle (user_id, at, date, type, title, body, ref) VALUES (?,?,?,?,?,?,?)')
    .run(uid, nowIso(), date, type, title, body, ref);
}

// Award practice XP exactly once per (user, kind, ref). Records level-ups in the Chronicle.
function award(uid, kind, ref, amount, label, date) {
  const before = levelFor(totalXp(uid));
  const r = db.prepare('INSERT OR IGNORE INTO xp_events (user_id, at, kind, ref, amount, label) VALUES (?,?,?,?,?,?)')
    .run(uid, nowIso(), kind, String(ref), amount, label);
  if (!r.changes) return null;
  chronicle(uid, 'payout', `+${amount} · ${label}`, '', null, date);
  const after = levelFor(totalXp(uid));
  if (after.n > before.n) {
    for (const l of LEVELS.filter((l) => l.n > before.n && l.n <= after.n)) {
      chronicle(uid, 'levelup', `You became ${l.name}`, `Chapter ${l.n} of the Tale has unsealed.`, `level-${l.n}`, date);
    }
  }
  return { amount, levelUp: after.n > before.n ? after : null };
}

// ---------- sessions & security ----------
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore bad cookie */ }
    }
  }
  return out;
}
function sessionUser(req) {
  const tok = parseCookies(req).rts_sid;
  if (!tok) return null;
  const u = db.prepare(`SELECT u.id, u.username, u.is_admin, u.disabled, u.last_seen, s.expires
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha256(tok));
  if (!u || u.expires < Date.now() || u.disabled) return null;
  const today = utcDate();
  if (!u.last_seen || u.last_seen.slice(0, 10) !== today) db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowIso(), u.id);
  return { id: u.id, username: u.username, isAdmin: !!u.is_admin };
}
function newSession(res, uid) {
  const tok = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?,?,?,?)').run(sha256(tok), uid, Date.now(), expires);
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(nowIso(), uid);
  res.setHeader('Set-Cookie', `rts_sid=${tok}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${COOKIE_SECURE ? '; Secure' : ''}`);
  return tok;
}
function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || '?';
}
// Simple in-memory throttles: 5 failures per 15 minutes per key.
const failures = new Map();
function throttled(...keys) { return keys.some((k) => { const f = failures.get(k); return f && f.count >= 5 && f.until > Date.now(); }); }
function noteFailure(...keys) {
  for (const k of keys) {
    const f = failures.get(k) || { count: 0, until: 0 };
    if (f.until < Date.now()) f.count = 0;
    f.count++; f.until = Date.now() + 15 * 60000;
    failures.set(k, f);
  }
}
const SLOW = { error: 'Please rest a while and try again.' };

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isBuf ? headers['Content-Type'] : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req, 256 * 1024);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw Object.assign(new Error('Bad JSON'), { status: 400 }); }
}

// ---------- images ----------
function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.length > 6 && buf.subarray(0, 3).toString() === 'GIF') return 'gif';
  return null;
}
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml', json: 'application/json', ico: 'image/x-icon', webmanifest: 'application/manifest+json' };
const UPLOAD_NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/;
// An image reference is valid only if it's empty or one of this user's own uploads.
function ownUpload(uid, u) {
  if (u === null || u === undefined || u === '') return true;
  if (typeof u !== 'string' || !u.startsWith('/uploads/')) return false;
  const name = u.slice('/uploads/'.length);
  return UPLOAD_NAME_RE.test(name) && !!db.prepare('SELECT 1 FROM uploads WHERE name = ? AND user_id = ?').get(name, uid);
}
function deleteUserFiles(uid) {
  for (const { name } of db.prepare('SELECT name FROM uploads WHERE user_id = ?').all(uid)) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); } catch { /* already gone */ }
  }
}

// ---------- data shaping ----------
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
function goalOut(g) { return { ...g, checks: parse(g.checks) || {} }; }
function goalsAll(uid) { return db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY is_main DESC, id').all(uid).map(goalOut); }
const hasMain = (uid) => !!db.prepare("SELECT 1 FROM goals WHERE user_id = ? AND status = 'active' AND is_main = 1").get(uid);

function weekQuests(uid, week) {
  let rows = db.prepare('SELECT * FROM quests WHERE user_id = ? AND week = ? ORDER BY id').all(uid, week);
  if (!rows.length) {
    const picks = pickQuests(week, goalsAll(uid));
    const ins = db.prepare('INSERT OR IGNORE INTO quests (user_id, week, template, goal_id, title, text, xp, status, updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const q of picks) ins.run(uid, week, q.template, q.goal_id, q.title, q.text, q.xp, 'offered', nowIso());
    rows = db.prepare('SELECT * FROM quests WHERE user_id = ? AND week = ? ORDER BY id').all(uid, week);
  }
  return rows;
}

function bootstrap(req, user) {
  const uid = user.id;
  const xp = totalXp(uid);
  const today = localDate(req);
  const ci = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND date = ?').get(uid, today);
  return {
    user: { id: uid, username: user.username, isAdmin: user.isAdmin },
    today, week: isoWeek(today),
    xp, level: levelFor(xp), levels: LEVELS,
    goals: goalsAll(uid),
    checkin: { date: today, morning: parse(ci?.morning), evening: parse(ci?.evening) },
    settings: {
      companionName: getUserSetting(db, uid, 'companionName', 'the Keeper'),
      portraitBase: getUserSetting(db, uid, 'portraitBase', null),
      portraits: getUserSetting(db, uid, 'portraits', {}),
      stepZeroDone: getUserSetting(db, uid, 'stepZeroDone', false),
    },
    frames: db.prepare("SELECT id, goal_id, frame, title FROM slides WHERE user_id = ? AND kind = 'target' AND frame IS NOT NULL AND frame != '' ORDER BY id DESC").all(uid),
    firstDay: db.prepare('SELECT MIN(date) d FROM checkins WHERE user_id = ?').get(uid).d || null,
    book: xp >= LEVELS[11].xp ? 2 : 1,
  };
}

function observatory(uid) {
  const q = (sql) => db.prepare(sql).get(uid);
  const days = db.prepare('SELECT date, morning, evening FROM checkins WHERE user_id = ? ORDER BY date').all(uid)
    .map((r) => ({ date: r.date, morning: !!parse(r.morning)?.complete, evening: !!parse(r.evening)?.complete }))
    .filter((d) => d.morning || d.evening);
  const xp = totalXp(uid);
  return {
    xp, level: levelFor(xp),
    framesComposed: days.filter((d) => d.morning).length,
    mirrorsHeld: days.filter((d) => d.evening).length,
    daysRecorded: days.length,
    firstRecorded: days[0]?.date || null,
    questsCompleted: q("SELECT COUNT(*) c FROM quests WHERE user_id = ? AND status = 'done'").c,
    slides: q('SELECT COUNT(*) c FROM slides WHERE user_id = ?').c,
    arrived: q('SELECT COUNT(*) c FROM slides WHERE user_id = ? AND arrived_at IS NOT NULL').c,
    trials: q('SELECT COUNT(*) c FROM trials WHERE user_id = ?').c,
    activeGoals: q("SELECT COUNT(*) c FROM goals WHERE user_id = ? AND status = 'active'").c,
    xpByKind: db.prepare('SELECT kind, SUM(amount) total, COUNT(*) n FROM xp_events WHERE user_id = ? GROUP BY kind').all(uid),
    days,
  };
}

// ---------- invites & reset codes ----------
function findCode(code) {
  const row = db.prepare('SELECT * FROM invites WHERE code_hash = ?').get(codeHash(code));
  if (!row || row.used_at || row.expires_at < nowIso()) return null;
  if (row.kind === 'reset') {
    const t = db.prepare('SELECT username, disabled FROM users WHERE id = ?').get(row.target_user);
    if (!t) return null;
    row.targetUsername = t.username;
  }
  return row;
}
function makeCode(kind, createdBy, { targetUser = null, note = '' } = {}) {
  const code = newCode();
  const expires = new Date(Date.now() + INVITE_DAYS * 86400000).toISOString();
  if (kind === 'reset') db.prepare("DELETE FROM invites WHERE kind = 'reset' AND target_user = ? AND used_at IS NULL").run(targetUser);
  db.prepare('INSERT INTO invites (code_hash, kind, target_user, note, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?)')
    .run(codeHash(code), kind, targetUser, note, createdBy, nowIso(), expires);
  return { code, expires_at: expires };
}
const adminCount = () => db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin = 1 AND disabled = 0').get().c;

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  const ip = clientIp(req);

  // Basic CSRF defence: mutations must carry our header and a same-origin Origin (if sent).
  if (m !== 'GET') {
    if (req.headers['x-rts'] !== '1') return send(res, 403, { error: 'Forbidden' });
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      try { if (new URL(origin).host !== host) return send(res, 403, { error: 'Forbidden' }); }
      catch { return send(res, 403, { error: 'Forbidden' }); }
    }
  }

  // ----- public endpoints -----
  if (p === '/api/state' && m === 'GET') {
    const u = sessionUser(req);
    return send(res, 200, { setup: userCount() > 0, authed: !!u });
  }
  if (p === '/api/setup' && m === 'POST') {
    if (userCount() > 0) return send(res, 409, { error: 'Already set up' });
    if (throttled(ip)) return send(res, 429, SLOW);
    const b = await readJson(req);
    const code = String(b.code || '');
    if (!SETUP_CODE || code.length !== SETUP_CODE.length || !crypto.timingSafeEqual(Buffer.from(code), Buffer.from(SETUP_CODE))) {
      noteFailure(ip); return send(res, 401, { error: 'That setup code doesn’t match.' });
    }
    const username = str(b.username, 32);
    const bad = checkUsername(username) || checkPassword(b.password);
    if (bad) return send(res, 400, { error: bad });
    const r = db.prepare('INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?,?,1,?)').run(username, hashPassword(b.password), nowIso());
    newSession(res, Number(r.lastInsertRowid));
    return send(res, 200, { ok: true });
  }
  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req);
    const username = str(b.username, 64).toLowerCase();
    if (throttled(ip, 'u:' + username)) return send(res, 429, SLOW);
    const u = db.prepare('SELECT id, password_hash, disabled FROM users WHERE username = ?').get(username);
    const ok = verifyPassword(String(b.password || ''), u?.password_hash);
    if (!ok) { noteFailure(ip, 'u:' + username); return send(res, 401, { error: 'That username and password don’t match.' }); }
    if (u.disabled) return send(res, 403, { error: 'This account has been paused by the site admin.' });
    failures.delete(ip); failures.delete('u:' + username);
    newSession(res, u.id);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/code' && m === 'POST') {
    // Look up what a one-time code is for, before the person fills in the form.
    if (throttled(ip)) return send(res, 429, SLOW);
    const b = await readJson(req);
    const row = findCode(b.code);
    if (!row) { noteFailure(ip); return send(res, 404, { error: 'That code isn’t valid or has expired.' }); }
    return send(res, 200, { kind: row.kind, username: row.kind === 'reset' ? row.targetUsername : null });
  }
  if (p === '/api/join' && m === 'POST') {
    if (throttled(ip)) return send(res, 429, SLOW);
    const b = await readJson(req);
    const row = findCode(b.code);
    if (!row) { noteFailure(ip); return send(res, 404, { error: 'That code isn’t valid or has expired.' }); }
    const pwBad = checkPassword(b.password);
    if (pwBad) return send(res, 400, { error: pwBad });
    let uid;
    if (row.kind === 'reset') {
      uid = row.target_user;
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(b.password), uid);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
      const disabled = db.prepare('SELECT disabled FROM users WHERE id = ?').get(uid).disabled;
      db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE id = ?').run(uid, nowIso(), row.id);
      if (disabled) return send(res, 403, { error: 'Password changed, but this account is paused by the site admin.' });
    } else {
      const username = str(b.username, 32);
      const bad = checkUsername(username);
      if (bad) return send(res, 400, { error: bad });
      if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return send(res, 409, { error: 'That username is taken. Try another.' });
      const r = db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?,?,?)').run(username, hashPassword(b.password), nowIso());
      uid = Number(r.lastInsertRowid);
      db.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE id = ?').run(uid, nowIso(), row.id);
    }
    newSession(res, uid);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/logout' && m === 'POST') {
    const tok = parseCookies(req).rts_sid;
    if (tok) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(tok));
    res.setHeader('Set-Cookie', `rts_sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${COOKIE_SECURE ? '; Secure' : ''}`);
    return send(res, 200, { ok: true });
  }

  const user = sessionUser(req);
  if (!user) return send(res, 401, { error: 'Not signed in' });
  const uid = user.id;

  if (p === '/api/me' && m === 'GET') return send(res, 200, bootstrap(req, user));

  // ----- site admin -----
  if (p.startsWith('/api/admin/')) {
    if (!user.isAdmin) return send(res, 403, { error: 'Admins only.' });
    return admin(req, res, p, m, user);
  }

  // --- goals (Step Zero) ---
  if (p === '/api/goals' && m === 'POST') {
    const b = await readJson(req);
    const title = str(b.title, 200);
    if (!title) return send(res, 400, { error: 'A goal needs a name.' });
    const checks = b.checks && typeof b.checks === 'object' ? b.checks : {};
    const required = ['mine', 'end', 'slide', 'calm', 'ownLife', 'door'];
    if (!required.every((k) => checks[k] === true)) return send(res, 400, { error: 'A goal enters only when all six gates feel right.' });
    const area = ['life', 'relationships', 'work', 'home', 'body', 'other'].includes(b.area) ? b.area : 'other';
    // The book: settle on one main goal; other wishes ride along as its attributes.
    const isMain = !hasMain(uid) ? 1 : 0;
    const r = db.prepare('INSERT INTO goals (user_id, area, title, scene, origin, path, freiling, checks, status, created_at, is_main) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(uid, area, title, str(b.scene), str(b.origin, 1000), str(b.path), str(b.freiling), JSON.stringify(checks), 'active', nowIso(), isMain);
    const id = Number(r.lastInsertRowid);
    const date = localDate(req);
    // If this week's invitations are all still untouched, let them re-form around the new goal.
    const wk = isoWeek(date);
    const touched = db.prepare("SELECT COUNT(*) c FROM quests WHERE user_id = ? AND week = ? AND status != 'offered'").get(uid, wk).c;
    if (!touched) db.prepare('DELETE FROM quests WHERE user_id = ? AND week = ?').run(uid, wk);
    chronicle(uid, 'goal', `${isMain ? 'Your main goal' : 'A goal of your own'}: ${title}`, str(b.scene), `goal-${id}`, date);
    const got = award(uid, 'goalAdmitted', id, XP.goalAdmitted, 'Chose a goal the Transurfing way', date);
    return send(res, 200, { id, award: got });
  }
  let mm;
  if ((mm = p.match(/^\/api\/goals\/(\d+)$/)) && m === 'PATCH') {
    const b = await readJson(req);
    const g = db.prepare("SELECT * FROM goals WHERE id = ? AND user_id = ? AND status = 'active'").get(Number(mm[1]), uid);
    if (!g) return send(res, 404, { error: 'Not found' });
    db.prepare('UPDATE goals SET title = ?, scene = ?, path = ?, freiling = ? WHERE id = ? AND user_id = ?')
      .run(str(b.title ?? g.title, 200) || g.title, str(b.scene ?? g.scene), str(b.path ?? g.path), str(b.freiling ?? g.freiling), g.id, uid);
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/goals\/(\d+)\/release$/)) && m === 'POST') {
    // Releasing is a healthy move. No failure is recorded anywhere.
    db.prepare("UPDATE goals SET status = 'released', released_at = ?, is_main = 0 WHERE id = ? AND user_id = ?").run(nowIso(), Number(mm[1]), uid);
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/goals\/(\d+)\/main$/)) && m === 'POST') {
    const g = db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ? AND status = 'active'").get(Number(mm[1]), uid);
    if (!g) return send(res, 404, { error: 'Not found' });
    db.prepare('UPDATE goals SET is_main = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE user_id = ?').run(g.id, uid);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/stepzero/done' && m === 'POST') { setUserSetting(db, uid, 'stepZeroDone', true); return send(res, 200, { ok: true }); }

  // --- check-in ---
  if ((mm = p.match(/^\/api\/checkin\/(\d{4}-\d{2}-\d{2})$/)) && m === 'GET') {
    const ci = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND date = ?').get(uid, mm[1]);
    return send(res, 200, { date: mm[1], morning: parse(ci?.morning), evening: parse(ci?.evening) });
  }
  if ((mm = p.match(/^\/api\/checkin\/(\d{4}-\d{2}-\d{2})\/(morning|evening)$/)) && m === 'PUT') {
    const [, date, part] = mm;
    if (!validDate(date) || date > localDate(req)) return send(res, 400, { error: 'That day hasn’t arrived yet.' });
    const b = await readJson(req);
    let entry;
    if (part === 'morning') {
      entry = { presence: b.presence === true, intention: str(b.intention, 2000), goal_id: Number(b.goal_id) || null, released: b.released === true, at: nowIso() };
      entry.complete = entry.presence && !!entry.intention && entry.released;
    } else {
      // coordination = the amalgam "My world takes care of me" (Ch. XVII); turn = coordinating intention on a setback (Ch. XIII)
      entry = { reflection: str(b.reflection), synchronicities: str(b.synchronicities, 2000), turn: str(b.turn, 2000), coordination: b.coordination === true, at: nowIso() };
      entry.complete = !!entry.reflection;
    }
    const col = part === 'morning' ? 'morning' : 'evening';
    db.prepare(`INSERT INTO checkins (user_id, date, ${col}) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET ${col} = excluded.${col}`)
      .run(uid, date, JSON.stringify(entry));
    let got = null;
    if (entry.complete) {
      if (part === 'morning') {
        chronicle(uid, 'intention', 'Frame switched on', entry.intention, `am-${date}`, date);
        got = award(uid, 'morningFrame', date, XP.morningFrame, 'Switched on the morning frame', date);
      } else {
        chronicle(uid, 'reflection', 'Mirror held', entry.reflection + (entry.turn ? `\n\n↻ ${entry.turn}` : '') + (entry.synchronicities ? `\n\n✦ ${entry.synchronicities}` : ''), `pm-${date}`, date);
        got = award(uid, 'eveningMirror', date, XP.eveningMirror, 'Held the evening mirror', date);
      }
    }
    return send(res, 200, { entry, award: got });
  }

  // --- quests ---
  if (p === '/api/quests' && m === 'GET') {
    const week = isoWeek(localDate(req));
    return send(res, 200, { week, quests: weekQuests(uid, week) });
  }
  if ((mm = p.match(/^\/api\/quests\/(\d+)$/)) && m === 'POST') {
    const b = await readJson(req);
    const week = isoWeek(localDate(req));
    const qrow = db.prepare('SELECT * FROM quests WHERE id = ? AND user_id = ? AND week = ?').get(Number(mm[1]), uid, week);
    if (!qrow) return send(res, 404, { error: 'That invitation has dissolved with the week.' });
    const next = { accept: 'accepted', decline: 'declined', abandon: 'offered', complete: 'done', reopen: 'offered' }[b.action];
    if (!next) return send(res, 400, { error: 'Unknown action' });
    if (qrow.status === 'done' && b.action !== 'complete') return send(res, 400, { error: 'Already lived.' });
    db.prepare('UPDATE quests SET status = ?, note = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(next, b.action === 'complete' ? str(b.note, 2000) : qrow.note, nowIso(), qrow.id, uid);
    let got = null;
    if (b.action === 'complete') {
      const date = localDate(req);
      chronicle(uid, 'quest', `Invitation lived: ${qrow.title}`, str(b.note, 2000), `quest-${qrow.id}`, date);
      got = award(uid, 'quest', qrow.id, qrow.xp, `Lived an invitation: ${qrow.title}`, date);
    }
    return send(res, 200, { ok: true, award: got });
  }

  // --- slides ---
  if (p === '/api/slides' && m === 'GET') return send(res, 200, db.prepare('SELECT * FROM slides WHERE user_id = ? ORDER BY id DESC').all(uid));
  if (p === '/api/slides' && m === 'POST') {
    const b = await readJson(req);
    if (!ownUpload(uid, b.image)) return send(res, 400, { error: 'Bad image' });
    const kind = b.kind === 'process' ? 'process' : 'target';
    const r = db.prepare('INSERT INTO slides (user_id, goal_id, kind, title, note, style, image, comfort, created_at, frame) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(uid, Number(b.goal_id) || null, kind, str(b.title, 200), str(b.note, 2000), str(b.style, 50), b.image || null, 'comfortable', nowIso(), str(b.frame, 120));
    const id = Number(r.lastInsertRowid);
    const got = award(uid, 'slideComposed', id, XP.slideComposed, `Composed a ${kind} slide`, localDate(req));
    return send(res, 200, { id, award: got });
  }
  if ((mm = p.match(/^\/api\/slides\/(\d+)$/)) && m === 'PATCH') {
    const b = await readJson(req);
    const s = db.prepare('SELECT * FROM slides WHERE id = ? AND user_id = ?').get(Number(mm[1]), uid);
    if (!s) return send(res, 404, { error: 'Not found' });
    if (b.image !== undefined && !ownUpload(uid, b.image)) return send(res, 400, { error: 'Bad image' });
    db.prepare('UPDATE slides SET title = ?, note = ?, style = ?, image = ?, comfort = ?, goal_id = ?, kind = ?, frame = ? WHERE id = ? AND user_id = ?').run(
      b.title !== undefined ? str(b.title, 200) : s.title,
      b.note !== undefined ? str(b.note, 2000) : s.note,
      b.style !== undefined ? str(b.style, 50) : s.style,
      b.image !== undefined ? (b.image || null) : s.image,
      ['comfortable', 'revisit'].includes(b.comfort) ? b.comfort : s.comfort,
      b.goal_id !== undefined ? (Number(b.goal_id) || null) : s.goal_id,
      ['target', 'process'].includes(b.kind) ? b.kind : s.kind,
      b.frame !== undefined ? str(b.frame, 120) : s.frame,
      s.id, uid);
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/slides\/(\d+)\/arrive$/)) && m === 'POST') {
    const b = await readJson(req);
    const s = db.prepare('SELECT * FROM slides WHERE id = ? AND user_id = ?').get(Number(mm[1]), uid);
    if (!s) return send(res, 404, { error: 'Not found' });
    if (!ownUpload(uid, b.image) || !validDate(b.date)) return send(res, 400, { error: 'Needs a date (and optionally a photo).' });
    db.prepare('UPDATE slides SET arrived_image = ?, arrived_at = ? WHERE id = ? AND user_id = ?').run(b.image || null, b.date, s.id, uid);
    chronicle(uid, 'arrived', `Arrived: ${s.title || 'a slide'}`, s.note || '', `arrived-${s.id}`, b.date);
    const got = award(uid, 'slideArrived', s.id, XP.slideArrived, 'Life caught up with a slide', localDate(req));
    return send(res, 200, { ok: true, award: got });
  }
  if ((mm = p.match(/^\/api\/slides\/(\d+)$/)) && m === 'DELETE') {
    db.prepare('DELETE FROM slides WHERE id = ? AND user_id = ?').run(Number(mm[1]), uid);
    return send(res, 200, { ok: true });
  }

  // --- uploads ---
  if (p === '/api/upload' && m === 'POST') {
    const buf = await readBody(req, 12 * 1024 * 1024);
    const ext = sniffImage(buf);
    if (!ext) return send(res, 400, { error: 'Please choose a JPEG, PNG, WebP or GIF image.' });
    const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    db.prepare('INSERT INTO uploads (name, user_id, created_at) VALUES (?,?,?)').run(name, uid, nowIso());
    return send(res, 200, { url: `/uploads/${name}` });
  }

  // --- tale ---
  if (p === '/api/tale' && m === 'GET') {
    const lvl = levelFor(totalXp(uid)).n;
    const done = new Map(db.prepare('SELECT chapter, response, at FROM trials WHERE user_id = ?').all(uid).map((t) => [t.chapter, t]));
    return send(res, 200, {
      book: BOOK_TITLE, prologue: PROLOGUE, level: lvl,
      chapters: CHAPTERS.map((c) => c.n <= lvl
        ? { n: c.n, title: c.title, sealed: false, text: c.text, trial: c.trial, trialDone: done.get(c.n) || null }
        : { n: c.n, title: c.title, sealed: true }),
    });
  }
  if ((mm = p.match(/^\/api\/tale\/(\d+)\/trial$/)) && m === 'POST') {
    const n = Number(mm[1]);
    const ch = CHAPTERS.find((c) => c.n === n);
    if (!ch || n > levelFor(totalXp(uid)).n) return send(res, 403, { error: 'This chapter is still sealed.' });
    const b = await readJson(req);
    const response = str(b.response);
    if (!response) return send(res, 400, { error: 'Write a few words first.' });
    const r = db.prepare('INSERT OR IGNORE INTO trials (user_id, chapter, response, at) VALUES (?,?,?,?)').run(uid, n, response, nowIso());
    if (!r.changes) return send(res, 409, { error: 'You’ve already walked this Trial.' });
    const date = localDate(req);
    chronicle(uid, 'trial', `Trial of Chapter ${n}: ${ch.trial.title}`, response, `trial-${n}`, date);
    const got = award(uid, 'trial', n, XP.trial, `Walked the Trial of Chapter ${n}`, date);
    return send(res, 200, { ok: true, award: got });
  }

  // --- chronicle & observatory ---
  if (p === '/api/chronicle' && m === 'GET') {
    const before = Number(url.searchParams.get('before')) || 1e15;
    return send(res, 200, db.prepare('SELECT * FROM chronicle WHERE user_id = ? AND id < ? ORDER BY id DESC LIMIT 60').all(uid, before));
  }
  if (p === '/api/observatory' && m === 'GET') return send(res, 200, observatory(uid));

  // --- settings & account ---
  if (p === '/api/settings' && m === 'PUT') {
    const b = await readJson(req);
    if (b.companionName !== undefined) setUserSetting(db, uid, 'companionName', str(b.companionName, 40) || 'the Keeper');
    if (b.portraitBase !== undefined) {
      if (!ownUpload(uid, b.portraitBase)) return send(res, 400, { error: 'Bad image' });
      setUserSetting(db, uid, 'portraitBase', b.portraitBase || null);
    }
    if (b.portrait && typeof b.portrait === 'object') {
      const lv = Number(b.portrait.level);
      if (!(lv >= 1 && lv <= 12) || !ownUpload(uid, b.portrait.image)) return send(res, 400, { error: 'Bad portrait' });
      const all = getUserSetting(db, uid, 'portraits', {});
      if (b.portrait.image) all[lv] = b.portrait.image; else delete all[lv];
      setUserSetting(db, uid, 'portraits', all);
    }
    return send(res, 200, { ok: true });
  }
  if (p === '/api/account/username' && m === 'POST') {
    const b = await readJson(req);
    const username = str(b.username, 32);
    const bad = checkUsername(username);
    if (bad) return send(res, 400, { error: bad });
    const clash = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (clash && clash.id !== uid) return send(res, 409, { error: 'That username is taken.' });
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, uid);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/password' && m === 'POST') {
    const b = await readJson(req);
    if (throttled('pw:' + uid)) return send(res, 429, SLOW);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(uid);
    if (!verifyPassword(String(b.current || ''), row.password_hash)) { noteFailure('pw:' + uid); return send(res, 401, { error: 'Current password doesn’t match.' }); }
    const bad = checkPassword(b.next);
    if (bad) return send(res, 400, { error: bad });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(b.next), uid);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
    newSession(res, uid);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/export' && m === 'GET') {
    const dump = { username: user.username };
    for (const t of ['goals', 'checkins', 'xp_events', 'quests', 'slides', 'trials', 'chronicle']) {
      dump[t] = db.prepare(`SELECT * FROM ${t} WHERE user_id = ?`).all(uid);
    }
    dump.settings = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(uid);
    return send(res, 200, dump, { 'Content-Disposition': `attachment; filename="rts-export-${user.username}-${utcDate()}.json"` });
  }

  return send(res, 404, { error: 'Not found' });
}

// ---------- site admin ----------
// Admins manage accounts only. They never see anyone's goals, journal or images.
async function admin(req, res, p, m, me) {
  let mm;
  if (p === '/api/admin/users' && m === 'GET') {
    const users = db.prepare(`SELECT u.id, u.username, u.is_admin, u.disabled, u.created_at, u.last_seen,
        (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires > ?) AS sessions
      FROM users u ORDER BY u.created_at`).all(Date.now());
    return send(res, 200, users);
  }
  if (p === '/api/admin/invites' && m === 'GET') {
    const rows = db.prepare(`SELECT i.id, i.kind, i.note, i.created_at, i.expires_at, i.used_at, t.username AS target, u.username AS used_by_name
      FROM invites i LEFT JOIN users t ON t.id = i.target_user LEFT JOIN users u ON u.id = i.used_by
      ORDER BY i.id DESC LIMIT 50`).all();
    return send(res, 200, rows);
  }
  if (p === '/api/admin/invites' && m === 'POST') {
    const b = await readJson(req);
    return send(res, 200, makeCode('invite', me.id, { note: str(b.note, 80) }));
  }
  if ((mm = p.match(/^\/api\/admin\/invites\/(\d+)$/)) && m === 'DELETE') {
    db.prepare('DELETE FROM invites WHERE id = ? AND used_at IS NULL').run(Number(mm[1]));
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/admin\/users\/(\d+)$/)) && (m === 'POST' || m === 'DELETE')) {
    const id = Number(mm[1]);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) return send(res, 404, { error: 'No such user.' });
    const b = await readJson(req);
    const self = id === me.id;
    const lastAdmin = target.is_admin && !target.disabled && adminCount() <= 1;

    if (m === 'DELETE') {
      if (self) return send(res, 400, { error: 'You can’t delete your own account here.' });
      if (lastAdmin) return send(res, 400, { error: 'That’s the last admin.' });
      if (String(b.confirm || '').toLowerCase() !== target.username.toLowerCase()) return send(res, 400, { error: 'Type their username to confirm.' });
      deleteUserFiles(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id); // cascades to all their data
      return send(res, 200, { ok: true });
    }
    switch (b.action) {
      case 'kick':
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        return send(res, 200, { ok: true });
      case 'block':
        if (self) return send(res, 400, { error: 'You can’t block yourself.' });
        if (lastAdmin) return send(res, 400, { error: 'That’s the last admin.' });
        db.prepare('UPDATE users SET disabled = 1 WHERE id = ?').run(id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        return send(res, 200, { ok: true });
      case 'unblock':
        db.prepare('UPDATE users SET disabled = 0 WHERE id = ?').run(id);
        return send(res, 200, { ok: true });
      case 'reset':
        return send(res, 200, makeCode('reset', me.id, { targetUser: id }));
      case 'make_admin':
        db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(id);
        return send(res, 200, { ok: true });
      case 'remove_admin':
        if (self) return send(res, 400, { error: 'Ask another admin to do this.' });
        if (lastAdmin) return send(res, 400, { error: 'That’s the last admin.' });
        db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(id);
        return send(res, 200, { ok: true });
      default:
        return send(res, 400, { error: 'Unknown action' });
    }
  }
  return send(res, 404, { error: 'Not found' });
}

// ---------- static ----------
function serveFile(res, file, cache = 'no-cache') {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'Not found' });
    const ext = path.extname(file).slice(1).toLowerCase();
    send(res, 200, buf, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/uploads/')) {
      const u = sessionUser(req);
      if (!u) return send(res, 401, { error: 'Not signed in' });
      const name = path.basename(url.pathname);
      // Each person's images are visible only to them.
      if (!UPLOAD_NAME_RE.test(name) || !db.prepare('SELECT 1 FROM uploads WHERE name = ? AND user_id = ?').get(name, u.id)) {
        return send(res, 404, { error: 'Not found' });
      }
      return serveFile(res, path.join(UPLOAD_DIR, name), 'private, max-age=31536000, immutable');
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || !path.extname(rel)) rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, { error: 'Not found' });
    return serveFile(res, file);
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Something went sideways.' });
  }
});

server.listen(PORT, () => console.log(`RTS-App listening on :${PORT}`));
