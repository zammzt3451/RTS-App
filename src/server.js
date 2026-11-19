// RTS-App — a personal Reality Transurfing practice journal.
// Zero npm dependencies: Node's built-in http, crypto and sqlite only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, getSetting, setSetting } from './db.js';
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

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = openDb(DATA_DIR);

// ---------- first-run setup code ----------
let SETUP_CODE = process.env.SETUP_CODE || null;
if (!getSetting(db, 'password') && !SETUP_CODE) {
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
function verifyPassword(pw, stored) {
  if (!stored) return false;
  const [, saltHex, hashHex] = stored.split('$');
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

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

function totalXp() { return db.prepare('SELECT COALESCE(SUM(amount),0) t FROM xp_events').get().t; }

function chronicle(type, title, body = '', ref = null, date = null) {
  if (ref) {
    const existing = db.prepare('SELECT id FROM chronicle WHERE type = ? AND ref = ?').get(type, ref);
    if (existing) {
      db.prepare('UPDATE chronicle SET title = ?, body = ? WHERE id = ?').run(title, body, existing.id);
      return;
    }
  }
  db.prepare('INSERT INTO chronicle (at, date, type, title, body, ref) VALUES (?,?,?,?,?,?)')
    .run(nowIso(), date, type, title, body, ref);
}

// Award practice XP exactly once per (kind, ref). Records level-ups in the Chronicle.
function award(kind, ref, amount, label, date) {
  const before = levelFor(totalXp());
  const r = db.prepare('INSERT OR IGNORE INTO xp_events (at, kind, ref, amount, label) VALUES (?,?,?,?,?)')
    .run(nowIso(), kind, String(ref), amount, label);
  if (!r.changes) return null;
  chronicle('payout', `+${amount} · ${label}`, '', null, date);
  const after = levelFor(totalXp());
  if (after.n > before.n) {
    for (const l of LEVELS.filter((l) => l.n > before.n && l.n <= after.n)) {
      chronicle('levelup', `You became ${l.name}`, `Chapter ${l.n} of the Tale has unsealed.`, `level-${l.n}`, date);
    }
  }
  return { amount, levelUp: after.n > before.n ? after : null };
}

// ---------- sessions & security ----------
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function sessionOk(req) {
  const tok = parseCookies(req).rts_sid;
  if (!tok) return false;
  const row = db.prepare('SELECT expires FROM sessions WHERE token_hash = ?').get(sha256(tok));
  return !!row && row.expires > Date.now();
}
function newSession(res) {
  const tok = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, created, expires) VALUES (?,?,?)').run(sha256(tok), Date.now(), expires);
  res.setHeader('Set-Cookie', `rts_sid=${tok}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${COOKIE_SECURE ? '; Secure' : ''}`);
}
function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || '?';
}
const failures = new Map(); // ip -> {count, until}
function throttled(ip) {
  const f = failures.get(ip);
  return f && f.count >= 5 && f.until > Date.now();
}
function noteFailure(ip) {
  const f = failures.get(ip) || { count: 0, until: 0 };
  if (f.until < Date.now()) f.count = 0;
  f.count++; f.until = Date.now() + 15 * 60000;
  failures.set(ip, f);
}

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
const validUpload = (u) => u === null || u === '' || (typeof u === 'string' && /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(u));

// ---------- data shaping ----------
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
function goalOut(g) { return { ...g, checks: parse(g.checks) || {} }; }
function goalsAll() { return db.prepare('SELECT * FROM goals ORDER BY is_main DESC, id').all().map(goalOut); }
const hasMain = () => !!db.prepare("SELECT 1 FROM goals WHERE status = 'active' AND is_main = 1").get();

function weekQuests(week) {
  let rows = db.prepare('SELECT * FROM quests WHERE week = ? ORDER BY id').all(week);
  if (!rows.length) {
    const picks = pickQuests(week, goalsAll());
    const ins = db.prepare('INSERT OR IGNORE INTO quests (week, template, goal_id, title, text, xp, status, updated_at) VALUES (?,?,?,?,?,?,?,?)');
    for (const q of picks) ins.run(week, q.template, q.goal_id, q.title, q.text, q.xp, 'offered', nowIso());
    rows = db.prepare('SELECT * FROM quests WHERE week = ? ORDER BY id').all(week);
  }
  return rows;
}

function bootstrap(req) {
  const xp = totalXp();
  const today = localDate(req);
  const ci = db.prepare('SELECT * FROM checkins WHERE date = ?').get(today);
  return {
    today, week: isoWeek(today),
    xp, level: levelFor(xp), levels: LEVELS,
    goals: goalsAll(),
    checkin: { date: today, morning: parse(ci?.morning), evening: parse(ci?.evening) },
    settings: {
      companionName: getSetting(db, 'companionName', 'the Keeper'),
      portraitBase: getSetting(db, 'portraitBase', null),
      portraits: getSetting(db, 'portraits', {}),
      stepZeroDone: getSetting(db, 'stepZeroDone', false),
    },
    frames: db.prepare("SELECT id, goal_id, frame, title FROM slides WHERE kind = 'target' AND frame IS NOT NULL AND frame != '' ORDER BY id DESC").all(),
    firstDay: db.prepare('SELECT MIN(date) d FROM checkins').get().d || null,
    book: xp >= LEVELS[11].xp ? 2 : 1,
  };
}

function observatory() {
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  const days = db.prepare('SELECT date, morning, evening FROM checkins ORDER BY date').all()
    .map((r) => ({ date: r.date, morning: !!parse(r.morning)?.complete, evening: !!parse(r.evening)?.complete }))
    .filter((d) => d.morning || d.evening);
  return {
    xp: totalXp(),
    level: levelFor(totalXp()),
    framesComposed: days.filter((d) => d.morning).length,
    mirrorsHeld: days.filter((d) => d.evening).length,
    daysRecorded: days.length,
    firstRecorded: days[0]?.date || null,
    questsCompleted: q("SELECT COUNT(*) c FROM quests WHERE status = 'done'").c,
    questsAccepted: q("SELECT COUNT(*) c FROM quests WHERE status IN ('accepted','done','abandoned')").c,
    slides: q('SELECT COUNT(*) c FROM slides').c,
    arrived: q('SELECT COUNT(*) c FROM slides WHERE arrived_at IS NOT NULL').c,
    trials: q('SELECT COUNT(*) c FROM trials').c,
    activeGoals: q("SELECT COUNT(*) c FROM goals WHERE status = 'active'").c,
    xpByKind: db.prepare('SELECT kind, SUM(amount) total, COUNT(*) n FROM xp_events GROUP BY kind').all(),
    days,
  };
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;

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

  if (p === '/api/state' && m === 'GET') {
    return send(res, 200, { setup: !!getSetting(db, 'password'), authed: sessionOk(req) });
  }
  if (p === '/api/setup' && m === 'POST') {
    if (getSetting(db, 'password')) return send(res, 409, { error: 'Already set up' });
    const ip = clientIp(req);
    if (throttled(ip)) return send(res, 429, { error: 'Please rest a while and try again.' });
    const b = await readJson(req);
    const code = String(b.code || '');
    if (!SETUP_CODE || code.length !== SETUP_CODE.length ||
        !crypto.timingSafeEqual(Buffer.from(code), Buffer.from(SETUP_CODE))) {
      noteFailure(ip); return send(res, 401, { error: 'That setup code doesn’t match.' });
    }
    if (typeof b.password !== 'string' || b.password.length < 10) return send(res, 400, { error: 'Use at least 10 characters.' });
    setSetting(db, 'password', hashPassword(b.password));
    newSession(res);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/login' && m === 'POST') {
    const ip = clientIp(req);
    if (throttled(ip)) return send(res, 429, { error: 'Please rest a while and try again.' });
    const b = await readJson(req);
    if (!verifyPassword(String(b.password || ''), getSetting(db, 'password'))) {
      noteFailure(ip); return send(res, 401, { error: 'That isn’t it. Breathe, and try again.' });
    }
    failures.delete(ip);
    newSession(res);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/logout' && m === 'POST') {
    const tok = parseCookies(req).rts_sid;
    if (tok) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(tok));
    res.setHeader('Set-Cookie', `rts_sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${COOKIE_SECURE ? '; Secure' : ''}`);
    return send(res, 200, { ok: true });
  }

  if (!sessionOk(req)) return send(res, 401, { error: 'Not signed in' });

  if (p === '/api/me' && m === 'GET') return send(res, 200, bootstrap(req));

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
    const isMain = !hasMain() ? 1 : 0;
    const r = db.prepare('INSERT INTO goals (area, title, scene, origin, path, freiling, checks, status, created_at, is_main) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(area, title, str(b.scene), str(b.origin, 1000), str(b.path), str(b.freiling), JSON.stringify(checks), 'active', nowIso(), isMain);
    const id = Number(r.lastInsertRowid);
    const date = localDate(req);
    // If this week's invitations are all still untouched, let them re-form around the new goal.
    const wk = isoWeek(date);
    const touched = db.prepare("SELECT COUNT(*) c FROM quests WHERE week = ? AND status != 'offered'").get(wk).c;
    if (!touched) db.prepare('DELETE FROM quests WHERE week = ?').run(wk);
    chronicle('goal', `${isMain ? 'Your main goal' : 'A goal of your own'}: ${title}`, str(b.scene), `goal-${id}`, date);
    const got = award('goalAdmitted', id, XP.goalAdmitted, 'Chose a goal the Transurfing way', date);
    return send(res, 200, { id, award: got });
  }
  let mm;
  if ((mm = p.match(/^\/api\/goals\/(\d+)$/)) && m === 'PATCH') {
    const b = await readJson(req);
    const g = db.prepare("SELECT * FROM goals WHERE id = ? AND status = 'active'").get(Number(mm[1]));
    if (!g) return send(res, 404, { error: 'Not found' });
    db.prepare('UPDATE goals SET title = ?, scene = ?, path = ?, freiling = ? WHERE id = ?')
      .run(str(b.title ?? g.title, 200) || g.title, str(b.scene ?? g.scene), str(b.path ?? g.path), str(b.freiling ?? g.freiling), g.id);
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/goals\/(\d+)\/release$/)) && m === 'POST') {
    // Releasing is a healthy move. No failure is recorded anywhere.
    db.prepare("UPDATE goals SET status = 'released', released_at = ?, is_main = 0 WHERE id = ?").run(nowIso(), Number(mm[1]));
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/goals\/(\d+)\/main$/)) && m === 'POST') {
    const g = db.prepare("SELECT id FROM goals WHERE id = ? AND status = 'active'").get(Number(mm[1]));
    if (!g) return send(res, 404, { error: 'Not found' });
    db.prepare('UPDATE goals SET is_main = CASE WHEN id = ? THEN 1 ELSE 0 END').run(g.id);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/stepzero/done' && m === 'POST') { setSetting(db, 'stepZeroDone', true); return send(res, 200, { ok: true }); }

  // --- check-in ---
  if ((mm = p.match(/^\/api\/checkin\/(\d{4}-\d{2}-\d{2})$/)) && m === 'GET') {
    const ci = db.prepare('SELECT * FROM checkins WHERE date = ?').get(mm[1]);
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
    db.prepare(`INSERT INTO checkins (date, ${part}) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET ${part} = excluded.${part}`)
      .run(date, JSON.stringify(entry));
    let got = null;
    if (entry.complete) {
      if (part === 'morning') {
        chronicle('intention', 'Frame switched on', entry.intention, `am-${date}`, date);
        got = award('morningFrame', date, XP.morningFrame, 'Switched on the morning frame', date);
      } else {
        chronicle('reflection', 'Mirror held', entry.reflection + (entry.turn ? `\n\n↻ ${entry.turn}` : '') + (entry.synchronicities ? `\n\n✦ ${entry.synchronicities}` : ''), `pm-${date}`, date);
        got = award('eveningMirror', date, XP.eveningMirror, 'Held the evening mirror', date);
      }
    }
    return send(res, 200, { entry, award: got });
  }

  // --- quests ---
  if (p === '/api/quests' && m === 'GET') {
    const week = isoWeek(localDate(req));
    return send(res, 200, { week, quests: weekQuests(week) });
  }
  if ((mm = p.match(/^\/api\/quests\/(\d+)$/)) && m === 'POST') {
    const b = await readJson(req);
    const week = isoWeek(localDate(req));
    const qrow = db.prepare('SELECT * FROM quests WHERE id = ? AND week = ?').get(Number(mm[1]), week);
    if (!qrow) return send(res, 404, { error: 'That invitation has dissolved with the week.' });
    const next = { accept: 'accepted', decline: 'declined', abandon: 'offered', complete: 'done', reopen: 'offered' }[b.action];
    if (!next) return send(res, 400, { error: 'Unknown action' });
    if (qrow.status === 'done' && b.action !== 'complete') return send(res, 400, { error: 'Already lived.' });
    db.prepare('UPDATE quests SET status = ?, note = ?, updated_at = ? WHERE id = ?')
      .run(next, b.action === 'complete' ? str(b.note, 2000) : qrow.note, nowIso(), qrow.id);
    let got = null;
    if (b.action === 'complete') {
      const date = localDate(req);
      chronicle('quest', `Invitation lived: ${qrow.title}`, str(b.note, 2000), `quest-${qrow.id}`, date);
      got = award('quest', qrow.id, qrow.xp, `Lived an invitation: ${qrow.title}`, date);
    }
    return send(res, 200, { ok: true, award: got });
  }

  // --- slides ---
  if (p === '/api/slides' && m === 'GET') return send(res, 200, db.prepare('SELECT * FROM slides ORDER BY id DESC').all());
  if (p === '/api/slides' && m === 'POST') {
    const b = await readJson(req);
    if (!validUpload(b.image ?? null)) return send(res, 400, { error: 'Bad image' });
    const kind = b.kind === 'process' ? 'process' : 'target';
    const r = db.prepare('INSERT INTO slides (goal_id, kind, title, note, style, image, comfort, created_at, frame) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(Number(b.goal_id) || null, kind, str(b.title, 200), str(b.note, 2000), str(b.style, 50), b.image || null, 'comfortable', nowIso(), str(b.frame, 120));
    const id = Number(r.lastInsertRowid);
    const got = award('slideComposed', id, XP.slideComposed, `Composed a ${kind} slide`, localDate(req));
    return send(res, 200, { id, award: got });
  }
  if ((mm = p.match(/^\/api\/slides\/(\d+)$/)) && m === 'PATCH') {
    const b = await readJson(req);
    const s = db.prepare('SELECT * FROM slides WHERE id = ?').get(Number(mm[1]));
    if (!s) return send(res, 404, { error: 'Not found' });
    if (b.image !== undefined && !validUpload(b.image)) return send(res, 400, { error: 'Bad image' });
    db.prepare('UPDATE slides SET title = ?, note = ?, style = ?, image = ?, comfort = ?, goal_id = ?, kind = ?, frame = ? WHERE id = ?').run(
      b.title !== undefined ? str(b.title, 200) : s.title,
      b.note !== undefined ? str(b.note, 2000) : s.note,
      b.style !== undefined ? str(b.style, 50) : s.style,
      b.image !== undefined ? (b.image || null) : s.image,
      ['comfortable', 'revisit'].includes(b.comfort) ? b.comfort : s.comfort,
      b.goal_id !== undefined ? (Number(b.goal_id) || null) : s.goal_id,
      ['target', 'process'].includes(b.kind) ? b.kind : s.kind,
      b.frame !== undefined ? str(b.frame, 120) : s.frame,
      s.id);
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/slides\/(\d+)\/arrive$/)) && m === 'POST') {
    const b = await readJson(req);
    const s = db.prepare('SELECT * FROM slides WHERE id = ?').get(Number(mm[1]));
    if (!s) return send(res, 404, { error: 'Not found' });
    if (!validUpload(b.image ?? null) || !validDate(b.date)) return send(res, 400, { error: 'Needs a date (and optionally a photo).' });
    db.prepare('UPDATE slides SET arrived_image = ?, arrived_at = ? WHERE id = ?').run(b.image || null, b.date, s.id);
    chronicle('arrived', `Arrived: ${s.title || 'a slide'}`, s.note || '', `arrived-${s.id}`, b.date);
    const got = award('slideArrived', s.id, XP.slideArrived, 'Life caught up with a slide', localDate(req));
    return send(res, 200, { ok: true, award: got });
  }
  if ((mm = p.match(/^\/api\/slides\/(\d+)$/)) && m === 'DELETE') {
    db.prepare('DELETE FROM slides WHERE id = ?').run(Number(mm[1]));
    return send(res, 200, { ok: true });
  }

  // --- uploads ---
  if (p === '/api/upload' && m === 'POST') {
    const buf = await readBody(req, 12 * 1024 * 1024);
    const ext = sniffImage(buf);
    if (!ext) return send(res, 400, { error: 'Please choose a JPEG, PNG, WebP or GIF image.' });
    const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return send(res, 200, { url: `/uploads/${name}` });
  }

  // --- tale ---
  if (p === '/api/tale' && m === 'GET') {
    const lvl = levelFor(totalXp()).n;
    const done = new Map(db.prepare('SELECT chapter, response, at FROM trials').all().map((t) => [t.chapter, t]));
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
    if (!ch || n > levelFor(totalXp()).n) return send(res, 403, { error: 'This chapter is still sealed.' });
    const b = await readJson(req);
    const response = str(b.response);
    if (!response) return send(res, 400, { error: 'Write a few words first.' });
    const r = db.prepare('INSERT OR IGNORE INTO trials (chapter, response, at) VALUES (?,?,?)').run(n, response, nowIso());
    if (!r.changes) return send(res, 409, { error: 'You’ve already walked this Trial.' });
    const date = localDate(req);
    chronicle('trial', `Trial of Chapter ${n}: ${ch.trial.title}`, response, `trial-${n}`, date);
    const got = award('trial', n, XP.trial, `Walked the Trial of Chapter ${n}`, date);
    return send(res, 200, { ok: true, award: got });
  }

  // --- chronicle & observatory ---
  if (p === '/api/chronicle' && m === 'GET') {
    const before = Number(url.searchParams.get('before')) || 1e15;
    const rows = db.prepare('SELECT * FROM chronicle WHERE id < ? ORDER BY id DESC LIMIT 60').all(before);
    return send(res, 200, rows);
  }
  if (p === '/api/observatory' && m === 'GET') return send(res, 200, observatory());

  // --- settings ---
  if (p === '/api/settings' && m === 'PUT') {
    const b = await readJson(req);
    if (b.companionName !== undefined) setSetting(db, 'companionName', str(b.companionName, 40) || 'the Keeper');
    if (b.portraitBase !== undefined) {
      if (!validUpload(b.portraitBase)) return send(res, 400, { error: 'Bad image' });
      setSetting(db, 'portraitBase', b.portraitBase || null);
    }
    if (b.portrait && typeof b.portrait === 'object') {
      const lv = Number(b.portrait.level);
      if (!(lv >= 1 && lv <= 12) || !validUpload(b.portrait.image ?? null)) return send(res, 400, { error: 'Bad portrait' });
      const all = getSetting(db, 'portraits', {});
      if (b.portrait.image) all[lv] = b.portrait.image; else delete all[lv];
      setSetting(db, 'portraits', all);
    }
    return send(res, 200, { ok: true });
  }
  if (p === '/api/password' && m === 'POST') {
    const b = await readJson(req);
    if (!verifyPassword(String(b.current || ''), getSetting(db, 'password'))) return send(res, 401, { error: 'Current password doesn’t match.' });
    if (typeof b.next !== 'string' || b.next.length < 10) return send(res, 400, { error: 'Use at least 10 characters.' });
    setSetting(db, 'password', hashPassword(b.next));
    db.prepare('DELETE FROM sessions').run();
    newSession(res);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/export' && m === 'GET') {
    const dump = {};
    for (const t of ['goals', 'checkins', 'xp_events', 'quests', 'slides', 'trials', 'chronicle']) dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
    dump.settings = db.prepare("SELECT key, value FROM settings WHERE key != 'password'").all();
    return send(res, 200, dump, { 'Content-Disposition': `attachment; filename="rts-export-${utcDate()}.json"` });
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
      if (!sessionOk(req)) return send(res, 401, { error: 'Not signed in' });
      const name = path.basename(url.pathname);
      if (!/^[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(name)) return send(res, 404, { error: 'Not found' });
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
