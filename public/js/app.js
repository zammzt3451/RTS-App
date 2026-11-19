import { SKY, COMPANION, portraitFrame, realmMap } from './art.js';
import { line } from './companion.js';

// ---------- tiny helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const localDate = (d = new Date()) => d.toLocaleDateString('en-CA');
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); };
const niceDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const AREAS = {
  relationships: { label: 'Relationships', icon: '💞' },
  work: { label: 'Work & purpose', icon: '🌟' },
  home: { label: 'Home & place', icon: '🏡' },
  body: { label: 'Body & vitality', icon: '🌿' },
  other: { label: 'Something else', icon: '✨' },
};
const app = $('#app');
let me = null;

async function api(path, opts = {}) {
  const headers = { 'X-RTS': '1', 'X-Local-Date': localDate(), ...(opts.headers || {}) };
  let body = opts.body;
  if (body && !(body instanceof Blob)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const res = await fetch(path, { method: opts.method || 'GET', headers, body, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/login') && !path.startsWith('/api/setup') && !path.startsWith('/api/password')) { me = null; renderChrome(); pageLogin(); throw new Error('Signed out'); }
  if (!res.ok) throw new Error(data.error || 'Something went sideways.');
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

function companion(kind, seed) {
  const name = me?.settings?.companionName || 'the Keeper';
  return `<div class="companion">${COMPANION}<div class="bubble"><small>${esc(name)}</small>${esc(line(kind, seed ?? Date.now() / 60000))}</div></div>`;
}

function modal(html, mount) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal card" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach((b) => b.addEventListener('click', close));
  mount?.(bg, close);
  return close;
}

async function refreshMe() { me = await api('/api/me'); renderChrome(); }

function handleAward(r, kind) {
  if (kind) toast(line(kind));
  if (r?.award) {
    setTimeout(() => toast(`✦ +${r.award.amount} practice`), kind ? 2700 : 0);
    if (r.award.levelUp) {
      const l = r.award.levelUp;
      setTimeout(() => modal(`
        <div class="center">
          <div class="big-portrait portrait"><div class="frame">${portraitFrame(l.n, 'lv')}${portraitImg(l.n)}</div></div>
          <h2 class="mt">You became ${esc(l.name)}</h2>
          ${companion('levelUp')}
          <div class="row" style="justify-content:center"><a class="btn" href="#/tale" data-close>Read Chapter ${l.n}</a><button class="ghost" data-close>Later</button></div>
        </div>`), 800);
    }
  }
}

// ---------- images ----------
function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        toast('Uploading…');
        const blob = file.type === 'image/gif' ? file : await shrink(file);
        const r = await api('/api/upload', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' } });
        resolve(r.url);
      } catch (e) { toast(e.message); resolve(null); }
    };
    input.click();
  });
}
function shrink(file, max = 1600) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
function portraitImg(n) {
  const custom = me?.settings?.portraits?.[n];
  const src = custom || me?.settings?.portraitBase;
  return src ? `<img src="${esc(src)}" alt="">` : `<div class="ph">🙂</div>`;
}

// ---------- chrome ----------
function renderChrome() {
  const authed = !!me;
  $('#topbar').hidden = !authed; $('#nav').hidden = !authed;
  if (!authed) return;
  $('#xpbadge').textContent = `${me.level.name} · ${me.xp} practice`;
  const r = (location.hash.split('/')[1] || 'board');
  const map = { observatory: 'more', chronicle: 'more', realm: 'more', settings: 'more', stepzero: 'more' };
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === (map[r] || r)));
}

// ---------- auth pages ----------
function pageSetup() {
  app.innerHTML = `<div class="auth card">
    <h2>Welcome to the reel</h2>
    <p class="muted">First run. Enter the one-time setup code from your server logs, then choose a password.</p>
    <label>Setup code</label><input id="code" type="text" autocomplete="off">
    <label>Password (10+ characters)</label><input id="pw" type="password" autocomplete="new-password">
    <button class="block mt" id="go">Begin</button><div class="err" id="err"></div></div>`;
  $('#go').onclick = async () => {
    try { await api('/api/setup', { method: 'POST', body: { code: $('#code').value.trim(), password: $('#pw').value } }); await start(); }
    catch (e) { $('#err').textContent = e.message; }
  };
}
function pageLogin() {
  app.innerHTML = `<div class="auth card">
    <div class="companion">${COMPANION}<div class="bubble"><small>Welcome back</small>The reel kept turning while you were away.</div></div>
    <label>Password</label><input id="pw" type="password" autocomplete="current-password">
    <button class="block mt" id="go">Step in</button><div class="err" id="err"></div></div>`;
  const go = async () => {
    try { await api('/api/login', { method: 'POST', body: { password: $('#pw').value } }); await start(); }
    catch (e) { $('#err').textContent = e.message; }
  };
  $('#go').onclick = go;
  $('#pw').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('#pw').focus();
}

// ---------- Quest Board ----------
async function pageBoard() {
  const [{ quests, week }, yesterday] = await Promise.all([api('/api/quests'), api(`/api/checkin/${addDays(me.today, -1)}`)]);
  const ci = me.checkin;
  const yUnrecorded = !yesterday.morning?.complete && !yesterday.evening?.complete;
  const next = me.level.next;
  const pct = next ? Math.round(((me.xp - me.level.xp) / (next.xp - me.level.xp)) * 100) : 100;
  const active = me.goals.filter((g) => g.status === 'active');

  app.innerHTML = `
    <h1>Quest Board</h1>
    <p class="sub">Invitations for ${esc(week)}. Accept, decline, or let go — all are fine.</p>
    ${companion(yUnrecorded && me.firstDay && me.firstDay < addDays(me.today, -1) ? 'unlogged' : 'greet')}
    <div class="card">
      <div class="spread"><h3>Today</h3><span class="muted small">${niceDate(me.today)}</span></div>
      <div class="grid2">
        <a class="btn ${ci.morning?.complete ? 'ghost' : ''}" href="#/checkin">🌅 ${ci.morning?.complete ? 'Frame lit' : 'Compose frame'}</a>
        <a class="btn ${ci.evening?.complete ? 'ghost' : ''}" href="#/checkin#evening">🪞 ${ci.evening?.complete ? 'Mirror held' : 'Evening mirror'}</a>
      </div>
    </div>
    <div class="card">
      <div class="spread"><h3>${esc(me.level.name)}</h3><span class="tag gold">Form ${me.level.n} of 12</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="muted small mt">${next ? `${me.xp} practice · ${esc(next.name)} at ${next.xp}` : 'Book I complete. Book II awaits.'} — practice only, never a measure of you.</p>
    </div>
    <h2 class="onsky">This week’s invitations</h2>
    ${quests.map(questCard).join('')}
    <p class="sub small">When the week turns, unfinished invitations simply dissolve. Nothing carries over.</p>
    <div class="card">
      <div class="spread"><h3>Your goals</h3><a class="btn small ghost" href="#/stepzero">+ Choose a goal</a></div>
      ${active.length ? active.map(goalRow).join('') : `<p class="muted">No goals yet. Step Zero helps you choose ones that are truly yours.</p>`}
      <p class="muted small">Private to you. Release any goal at any time — that’s a healthy move.</p>
    </div>`;

  $$('[data-q]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.q, action = b.dataset.a;
    if (action === 'complete') return completeQuest(id);
    try {
      await api(`/api/quests/${id}`, { method: 'POST', body: { action } });
      toast(line({ accept: 'questAccept', decline: 'questDecline', abandon: 'questLetGo', reopen: 'questAccept' }[action]));
      pageBoard();
    } catch (e) { toast(e.message); }
  });
  $$('[data-release]').forEach((b) => b.onclick = () => releaseGoal(Number(b.dataset.release)));
}
function questCard(q) {
  const btns = {
    offered: `<button class="small" data-q="${q.id}" data-a="accept">Accept</button><button class="small ghost" data-q="${q.id}" data-a="decline">Decline</button>`,
    accepted: `<button class="small green" data-q="${q.id}" data-a="complete">I lived it</button><button class="small ghost" data-q="${q.id}" data-a="abandon">Let it go</button>`,
    declined: `<button class="small ghost" data-q="${q.id}" data-a="reopen">Reconsider</button>`,
    done: `<span class="tag">✓ Lived</span>`,
  }[q.status] || '';
  return `<div class="card quest ${q.status}">
    <div class="spread"><h3>${esc(q.title)}</h3><span class="tag gold">+${q.xp}</span></div>
    <p>${esc(q.text)}</p>
    ${q.status === 'done' && q.note ? `<p class="muted small">“${esc(q.note)}”</p>` : ''}
    <div class="row">${btns}</div></div>`;
}
function completeQuest(id) {
  modal(`<h3>How did it go?</h3><p class="muted small">Optional. A line for your Chronicle.</p>
    <textarea id="qn" placeholder="What did you notice?"></textarea>
    <div class="row mt"><button id="qs" class="green">Mark as lived</button><button class="ghost" data-close>Cancel</button></div>`,
  (el, close) => {
    $('#qs', el).onclick = async () => {
      try { const r = await api(`/api/quests/${id}`, { method: 'POST', body: { action: 'complete', note: $('#qn', el).value } }); close(); await refreshMe(); handleAward(r, 'questDone'); pageBoard(); }
      catch (e) { toast(e.message); }
    };
  });
}
function goalRow(g) {
  const a = AREAS[g.area] || AREAS.other;
  return `<div class="entry"><div class="ico">${a.icon}</div><div style="flex:1">
    <b>${esc(g.title)}</b><div class="muted small">${esc(g.scene || '')}</div>
    ${g.freiling ? `<div class="small">💝 I give: ${esc(g.freiling)}</div>` : ''}
    <div class="row mt"><button class="small ghost" data-release="${g.id}">Release</button></div></div></div>`;
}
function releaseGoal(id) {
  modal(`<h3>Release this goal?</h3>
    ${companion('release', id)}
    <p class="muted">Clinging is importance. Letting go leaves no record of failure — only room.</p>
    <div class="row"><button id="rg" class="gold">Release it, lightly</button><button class="ghost" data-close>Keep it</button></div>`,
  (el, close) => {
    $('#rg', el).onclick = async () => { await api(`/api/goals/${id}/release`, { method: 'POST' }); close(); await refreshMe(); toast(line('release', id + 1)); route(); };
  });
}

// ---------- Step Zero ----------
let sz = null;
function freshSz() { return { step: 1, area: null, title: '', origin: '', scene: '', freiling: '', path: '', checks: {}, branch: null }; }
function pageStepZero() {
  if (!sz) sz = freshSz();
  const intro = !me.goals.length && !me.settings.stepZeroDone;
  if (intro && sz.step === 1 && !sz.seenIntro) return stepZeroIntro();
  const total = 9;
  const s = sz.step;
  const has = (a) => me.goals.some((g) => g.status === 'active' && g.area === a);
  const chosenNote = (t) => `<div class="note">${t}</div>`;
  let body = '';

  if (s === 1) {
    body = `<div class="gate-num">Begin</div><h2>Which part of life is this goal in?</h2>
      <div class="choices">${Object.entries(AREAS).map(([k, a]) => `<button class="choice" data-area="${k}"><b>${a.icon} ${a.label}</b>${has(k) ? '<span class="muted small">You already hold a goal here</span>' : ''}</button>`).join('')}</div>`;
  } else if (s === 2) {
    body = `<div class="gate-num">Name it</div><h2>What do you wish for?</h2>
      <p class="muted">Say it plainly, in your own words. We’ll test it gently next.</p>
      <input id="t" type="text" value="${esc(sz.title)}" placeholder="e.g. A home full of light by the water">
      <button class="block mt" id="next">Continue</button>`;
  } else if (s === 3) {
    body = `<div class="gate-num">Gate 1 of 6 · Is it mine?</div>
      <h2>If nobody would ever know, would you still want this?</h2>
      <p class="muted">A true goal comes from the soul — not from prestige, advertising, others’ expectations, or proving something.</p>
      <div class="choices">
        <button class="choice" data-c="yes"><b>Yes — I’d want it even in secret</b></button>
        <button class="choice" data-c="unsure"><b>I’m not sure</b></button>
        <button class="choice" data-c="no"><b>Honestly, no</b></button>
      </div>
      ${sz.branch === 'unsure' ? chosenNote(`Whose voice is it? Notice if you’re talking yourself into it. That’s useful information, not a fault.`) + `
        <div class="row"><button class="small ghost" id="back2">Rephrase my wish</button><button class="small" id="mineYes">It’s mine after all</button><button class="small gold" id="letgo">Let it go</button></div>` : ''}
      ${sz.branch === 'no' ? chosenNote(`Thank you for being honest. A wish that isn’t yours would only feed a pendulum.`) + `
        <div class="row"><button class="small ghost" id="back2">Rephrase my wish</button><button class="small gold" id="letgo">Let it go</button></div>` : ''}`;
  } else if (s === 4) {
    body = `<div class="gate-num">Gate 2 of 6 · An end, not a means?</div>
      <h2>Is “${esc(sz.title)}” the scene itself — or a way to buy a scene?</h2>
      <p class="muted">Money, fame, and status are never goals. They arrive as attributes of a goal.</p>
      <div class="choices">
        <button class="choice" data-c="end"><b>It’s the scene itself</b>The life I actually want to live</button>
        <button class="choice" data-c="means"><b>It’s a means</b>Money, a title, recognition, a number…</button>
      </div>
      ${sz.branch === 'means' ? `<label>What life-scene was it meant to buy?</label>
        <textarea id="endScene" placeholder="If you had it, what would you be doing on an ordinary Tuesday?"></textarea>
        <button class="block mt" id="useEnd">Make that my goal</button>` : ''}`;
  } else if (s === 5) {
    body = `<div class="gate-num">Gate 3 of 6 · Does the slide feel like mine?</div>
      <h2>Picture yourself already living it.</h2>
      <p class="muted">From inside your own eyes, not watching yourself from across the room. Write it in the present tense.</p>
      <textarea id="scene" placeholder="I’m sitting… I can hear… I feel…">${esc(sz.scene)}</textarea>
      <h3 class="mt">How does the picture feel?</h3>
      <div class="choices">
        <button class="choice" data-c="comfy"><b>Comfortable and quietly joyful</b>Like home</button>
        <button class="choice" data-c="off"><b>Alien, tense, or a bit off</b></button>
      </div>
      ${sz.branch === 'off' ? chosenNote(`Never push through discomfort. Change the scene — or your version of the goal — until it feels like home. Edit above, then feel again.`) + `
        <div class="row"><button class="small ghost" id="back2">Reshape the goal itself</button></div>` : ''}`;
  } else if (s === 6) {
    body = `<div class="gate-num">Gate 4 of 6 · Is happiness conditional on it?</div>
      <h2>Can you hold it the way you’d hold a trip to buy a newspaper?</h2>
      <p class="muted">Calm certainty, no desperation. If you can’t be happy until you have it, that’s excess importance — and balance forces push back.</p>
      <div class="choices">
        <button class="choice" data-c="calm"><b>Yes — calm and unhurried</b></button>
        <button class="choice" data-c="heavy"><b>It feels like I need it to be happy</b></button>
      </div>
      ${sz.branch === 'heavy' ? chosenNote(`Try this: name three things that already make you happy. Picture an ordinary good day without this goal. Then picture it simply arriving, the way the newspaper does. Lower the weight, keep the wish.`) + `
        <div class="row"><button class="small" id="calmNow">I can hold it lightly now</button><button class="small gold" id="letgo">Set it aside for now</button></div>` : ''}`;
  } else if (s === 7) {
    const rel = sz.area === 'relationships';
    body = `<div class="gate-num">Gate 5 of 6 · About your own life only?</div>
      <h2>Is this about your life — not changing, winning over, or controlling someone?</h2>
      <div class="choices">
        <button class="choice" data-c="own"><b>Yes, it’s my own life</b></button>
        <button class="choice" data-c="other"><b>It involves changing someone</b></button>
      </div>
      ${(sz.branch === 'other' || (rel && sz.branch === 'own')) ? `
        ${chosenNote(`<b>Freiling:</b> replace the intention to <i>get</i> with the intention to <i>give</i>. Reshape it around your own life, and what you’ll offer.`)}
        <label>What will you give?</label>
        <textarea id="freiling" placeholder="Warmth, attention, ease, respect…">${esc(sz.freiling)}</textarea>
        ${sz.branch === 'other' ? `<label>Your goal, reshaped around your own life</label><input id="reshaped" type="text" value="${esc(sz.title)}">` : ''}
        <button class="block mt" id="freilingNext">Continue</button>` : ''}`;
  } else if (s === 8) {
    body = `<div class="gate-num">Gate 6 of 6 · Is the path your door?</div>
      <h2>Does the way toward it feel enjoyable in itself?</h2>
      <p class="muted">The journey should be lived with pleasure, not paid like a toll.</p>
      <div class="choices">
        <button class="choice" data-c="door"><b>Yes, I’d enjoy the way there</b></button>
        <button class="choice" data-c="toll"><b>Every step sounds like suffering</b></button>
      </div>
      ${sz.branch ? `
        ${sz.branch === 'toll' ? chosenNote(`Then it’s the wrong door — not the wrong scene. Find another route to the same scene that you’d actually enjoy.`) : ''}
        <label>${sz.branch === 'toll' ? 'Another door to the same scene' : 'What part of the path do you look forward to?'}</label>
        <textarea id="path">${esc(sz.path)}</textarea>
        <button class="block mt" id="pathNext">Continue</button>` : ''}`;
  } else if (s === 9) {
    const a = AREAS[sz.area] || AREAS.other;
    body = `<div class="gate-num">All six gates feel right</div>
      <h2>${a.icon} ${esc(sz.title)}</h2>
      ${sz.origin ? `<p class="muted small">Found beneath: “${esc(sz.origin)}”</p>` : ''}
      <p><i>${esc(sz.scene)}</i></p>
      ${sz.freiling ? `<p>💝 I give: ${esc(sz.freiling)}</p>` : ''}
      ${sz.path ? `<p>🚪 My door: ${esc(sz.path)}</p>` : ''}
      <div class="note green">Hold the end frame only. The “how” belongs to outer intention.</div>
      <button class="block green" id="admit">Admit this goal</button>`;
  } else if (s === 10) {
    const missing = ['relationships', 'work', 'home', 'body'].filter((k) => !has(k));
    body = `${companion('goalAdmitted')}
      <h2>Choose another?</h2>
      ${missing.length ? `<p class="muted">Areas without a goal yet: ${missing.map((k) => AREAS[k].icon + ' ' + AREAS[k].label).join(', ')}</p>` : '<p class="muted">You hold a goal in each area.</p>'}
      <div class="row"><button id="another">Choose another goal</button><button class="ghost" id="finish">That’s enough for now</button></div>`;
  }

  app.innerHTML = `<h1>Step Zero</h1><p class="sub">Choosing goals that are truly yours.</p>
    ${s < 10 ? companion('stepzero', s) : ''}
    <div class="card">${s < 10 ? `<div class="steps">${Array.from({ length: total }, (_, i) => `<i class="${i < s ? 'on' : ''}"></i>`).join('')}</div>` : ''}${body}
    ${s > 1 && s < 10 ? `<button class="small ghost mt" id="prev">← Back</button>` : ''}</div>`;

  const go = (n) => { sz.step = n; sz.branch = null; pageStepZero(); window.scrollTo(0, 0); };
  const bind = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  bind('#prev', () => go(s - 1));
  bind('#back2', () => go(2));
  bind('#letgo', () => { toast(line('release')); sz = freshSz(); pageStepZero(); });
  $$('[data-area]').forEach((b) => b.onclick = () => { sz.area = b.dataset.area; go(2); });
  bind('#next', () => { const v = $('#t').value.trim(); if (!v) return toast('Give it a few words.'); sz.title = v; go(3); });
  $$('[data-c]').forEach((b) => b.onclick = () => {
    const c = b.dataset.c;
    const scene = $('#scene'); if (scene) sz.scene = scene.value.trim();
    if (c === 'yes') { sz.checks.mine = true; return go(4); }
    if (c === 'end') { sz.checks.end = true; return go(5); }
    if (c === 'comfy') { if (!sz.scene) return toast('Write the scene first — just a few lines.'); sz.checks.slide = true; return go(6); }
    if (c === 'calm') { sz.checks.calm = true; return go(7); }
    if (c === 'own' && sz.area !== 'relationships') { sz.checks.ownLife = true; return go(8); }
    if (c === 'door') { sz.checks.door = true; }
    sz.branch = c === 'door' ? 'door' : c; pageStepZero();
  });
  bind('#mineYes', () => { sz.checks.mine = true; go(4); });
  bind('#useEnd', () => {
    const v = $('#endScene').value.trim(); if (!v) return toast('Describe the scene it was meant to buy.');
    sz.origin = sz.title; sz.title = v.length > 90 ? v.slice(0, 90) + '…' : v; sz.scene = v; sz.checks.end = true; go(5);
  });
  bind('#calmNow', () => { sz.checks.calm = true; go(7); });
  bind('#freilingNext', () => {
    sz.freiling = $('#freiling').value.trim();
    const re = $('#reshaped');
    if (re) { if (!sz.freiling) return toast('Name what you’ll give.'); sz.title = re.value.trim() || sz.title; }
    sz.checks.ownLife = true; go(8);
  });
  bind('#pathNext', () => {
    sz.path = $('#path').value.trim();
    if (sz.branch === 'toll' && !sz.path) return toast('Find a door you’d enjoy walking through.');
    sz.checks.door = true; go(9);
  });
  bind('#admit', async () => {
    try {
      const r = await api('/api/goals', { method: 'POST', body: { area: sz.area, title: sz.title, scene: sz.scene, origin: sz.origin, freiling: sz.freiling, path: sz.path, checks: sz.checks } });
      await refreshMe(); handleAward(r); sz = { ...freshSz(), step: 10, seenIntro: true }; pageStepZero();
    } catch (e) { toast(e.message); }
  });
  bind('#another', () => { sz = { ...freshSz(), seenIntro: true }; pageStepZero(); });
  bind('#finish', async () => { await api('/api/stepzero/done', { method: 'POST' }); await refreshMe(); sz = null; location.hash = '#/board'; });
}
function stepZeroIntro() {
  app.innerHTML = `<h1>Step Zero</h1><p class="sub">Before anything is tracked.</p>
    ${companion('stepzero', 1)}
    <div class="card">
      <h2>Goals that are truly yours</h2>
      <p>In Transurfing you don’t grind toward a goal. You choose one that is really yours, hold it lightly, and move calmly while the world shifts to meet you.</p>
      <p>Each goal passes six gentle gates: is it <b>mine</b>, an <b>end</b>, a <b>comfortable slide</b>, held <b>calmly</b>, about <b>my own life</b>, and through an <b>enjoyable door</b>?</p>
      <p class="muted small">Your goals stay private on your server. You can release any of them at any time, with no record of failure.</p>
      <button class="block" id="begin">Begin</button>
    </div>`;
  $('#begin').onclick = () => { sz.seenIntro = true; pageStepZero(); };
}

// ---------- Check-In ----------
let ciDate = null;
async function pageCheckin() {
  if (!ciDate || ciDate > me.today) ciDate = me.today;
  const ci = await api(`/api/checkin/${ciDate}`);
  const m = ci.morning || {}, e = ci.evening || {};
  const active = me.goals.filter((g) => g.status === 'active');
  const isToday = ciDate === me.today;
  const unrecorded = !isToday && !m.complete && !e.complete;
  const days = Array.from({ length: 7 }, (_, i) => addDays(me.today, -i));

  app.innerHTML = `<h1>Check-In</h1>
    <p class="sub">The frame in the morning. The mirror at night.</p>
    <div class="row" style="margin:0 0 12px;overflow-x:auto;flex-wrap:nowrap">${days.map((d) => `<button class="small ${d === ciDate ? '' : 'ghost'}" style="${d === ciDate ? '' : 'background:rgba(255,255,255,.75)'}" data-day="${d}">${d === me.today ? 'Today' : niceDate(d)}</button>`).join('')}</div>
    ${unrecorded ? companion('unlogged', ciDate.length + Number(ciDate.slice(-2))) : companion(m.complete ? (e.complete ? 'eveningDone' : 'evening') : 'morning')}
    <div class="card ${m.complete ? 'glow' : ''}" id="morning">
      <div class="spread"><h2>🌅 Composing the frame</h2>${m.complete ? '<span class="tag">Lit</span>' : ''}</div>
      <p class="muted small">1 · A moment of presence</p>
      <p>Turn your attention inward. Then let it rise and settle just behind your shoulder blades, where the plait of intention lives. A breath or two is enough.</p>
      <label class="check"><input type="checkbox" id="presence" ${m.presence ? 'checked' : ''}> I paused, turned inward, and felt the plait.</label>
      <p class="muted small mt">2 · The scene, as if it’s already real</p>
      ${active.length ? `<select id="goal"><option value="">Any scene of mine</option>${active.map((g) => `<option value="${g.id}" ${m.goal_id === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>` : ''}
      <textarea id="intention" class="mt" placeholder="I am… (present tense — felt, declared)">${esc(m.intention || '')}</textarea>
      <label class="check"><input type="checkbox" id="released" ${m.released ? 'checked' : ''}> I felt it, declared it, and released it. No craving, no rehearsing it all day.</label>
      <button class="block" id="saveM">${m.complete ? 'Update the frame' : 'Light the frame'}</button>
    </div>
    <div class="card ${e.complete ? 'glow' : ''}" id="evening">
      <div class="spread"><h2>🪞 Mirror work</h2>${e.complete ? '<span class="tag">Held</span>' : ''}</div>
      <label>What did reality reflect back today?</label>
      <textarea id="reflection" placeholder="Moments, moods, small turns…">${esc(e.reflection || '')}</textarea>
      <label>Answers or synchronicities <span class="muted">(no need to find any — the mirror answers late)</span></label>
      <textarea id="sync" style="min-height:70px">${esc(e.synchronicities || '')}</textarea>
      <label class="check"><input type="checkbox" id="coord" ${e.coordination ? 'checked' : ''}> My world takes care of me.</label>
      <button class="block" id="saveE">${e.complete ? 'Update the mirror' : 'Hold the mirror'}</button>
    </div>`;

  $$('[data-day]').forEach((b) => b.onclick = () => { ciDate = b.dataset.day; pageCheckin(); });
  $('#saveM').onclick = async () => {
    const body = { presence: $('#presence').checked, intention: $('#intention').value, released: $('#released').checked, goal_id: $('#goal')?.value || null };
    if (!body.presence || !body.intention.trim() || !body.released) toast('Saved. The frame lights once presence, scene, and release are all there.');
    const r = await api(`/api/checkin/${ciDate}/morning`, { method: 'PUT', body });
    await refreshMe(); if (r.entry.complete) handleAward(r, 'morningDone'); pageCheckin();
  };
  $('#saveE').onclick = async () => {
    const body = { reflection: $('#reflection').value, synchronicities: $('#sync').value, coordination: $('#coord').checked };
    if (!body.reflection.trim()) return toast('A line or two about the day is enough.');
    const r = await api(`/api/checkin/${ciDate}/evening`, { method: 'PUT', body });
    await refreshMe(); handleAward(r, 'eveningDone'); pageCheckin();
  };
  if (location.hash.endsWith('#evening')) $('#evening').scrollIntoView({ behavior: 'smooth' });
}

// ---------- Slide Album ----------
async function pageAlbum() {
  const slides = await api('/api/slides');
  const goals = me.goals;
  const gName = (id) => goals.find((g) => g.id === id)?.title;
  app.innerHTML = `<h1>Slide Album</h1>
    <p class="sub">End frames, held lightly — and scenes of enjoying the path.</p>
    ${companion('slide')}
    <button class="block" id="newSlide" style="margin-bottom:14px">+ Compose a slide</button>
    <div class="slides">${slides.map((s) => `
      <div class="card slide ${s.comfort === 'revisit' ? '' : ''}">
        <div class="pic">${s.arrived_at ? '<span class="arrived">✓ Arrived ' + esc(niceDate(s.arrived_at)) + '</span>' : ''}
          ${s.arrived_image ? `<div class="duo">${s.image ? `<img src="${esc(s.image)}" alt="Vision">` : '<div></div>'}<img src="${esc(s.arrived_image)}" alt="Real photo"></div>`
            : s.image ? `<img src="${esc(s.image)}" alt="">` : (s.kind === 'process' ? '🚶' : '🎞️')}</div>
        <div class="body">
          <div class="row"><span class="tag ${s.kind === 'process' ? 'rose' : 'gold'}">${s.kind === 'process' ? 'Process slide' : 'Target slide'}</span>${s.style ? `<span class="tag">${esc(s.style)}</span>` : ''}</div>
          <h3 class="mt">${esc(s.title || 'Untitled slide')}</h3>
          ${gName(s.goal_id) ? `<div class="muted small">${esc(gName(s.goal_id))}</div>` : ''}
          ${s.note ? `<p><i>${esc(s.note)}</i></p>` : ''}
          ${s.comfort === 'revisit' ? `<div class="note">This slide asked to be looked at again. That’s information, not failure. <a href="#/stepzero">Revisit Step Zero</a> or reshape it.</div>` : ''}
          <div class="row">
            <button class="small ghost" data-edit="${s.id}">Reshape</button>
            <button class="small ghost" data-feel="${s.id}" data-v="${s.comfort === 'revisit' ? 'comfortable' : 'revisit'}">${s.comfort === 'revisit' ? 'Feels right again' : 'Feels off'}</button>
            ${s.arrived_at ? '' : `<button class="small green" data-arrive="${s.id}">Arrived</button>`}
          </div>
        </div>
      </div>`).join('') || `<div class="card"><p class="muted">No slides yet. Compose your first end scene — you, inside it, living it.</p></div>`}</div>`;

  $('#newSlide').onclick = () => slideForm(null);
  $$('[data-edit]').forEach((b) => b.onclick = () => slideForm(slides.find((s) => s.id === Number(b.dataset.edit))));
  $$('[data-feel]').forEach((b) => b.onclick = async () => {
    await api(`/api/slides/${b.dataset.feel}`, { method: 'PATCH', body: { comfort: b.dataset.v } });
    if (b.dataset.v === 'revisit') toast(line('slideRevisit'));
    pageAlbum();
  });
  $$('[data-arrive]').forEach((b) => b.onclick = () => arriveForm(Number(b.dataset.arrive)));
}
function slideForm(s) {
  let image = s?.image || null;
  const active = me.goals.filter((g) => g.status === 'active');
  modal(`<h3>${s ? 'Reshape slide' : 'Compose a slide'}</h3>
    <div class="note small">Hold the end frame only — never script the route. Be <b>inside</b> the scene, not watching yourself from outside.</div>
    <div class="choices" style="grid-template-columns:1fr 1fr">
      <button class="choice ${(!s || s.kind === 'target') ? 'sel' : ''}" data-kind="target"><b>🎞️ Target</b>The end scene</button>
      <button class="choice ${s?.kind === 'process' ? 'sel' : ''}" data-kind="process"><b>🚶 Process</b>Enjoying the path</button>
    </div>
    <label>Goal</label><select id="sg"><option value="">—</option>${active.map((g) => `<option value="${g.id}" ${s?.goal_id === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>
    <label>Title</label><input id="st" type="text" value="${esc(s?.title || '')}" placeholder="Morning on the porch">
    <label>Intention note (present tense)</label><textarea id="sn" placeholder="I’m sipping coffee while the light comes up over the water…">${esc(s?.note || '')}</textarea>
    <label>Style</label><select id="ss">${['Storybook', 'Photorealistic'].map((x) => `<option ${s?.style === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label>Image</label><div id="sprev">${image ? `<img class="thumb" src="${esc(image)}" alt="">` : ''}</div>
    <button class="small ghost mt" id="simg">${image ? 'Change image' : 'Upload an image'}</button>
    <div class="row mt"><button id="ssave">${s ? 'Save' : 'Compose'}</button>${s ? '<button class="ghost" id="sdel">Remove</button>' : ''}<button class="ghost" data-close>Cancel</button></div>`,
  (el, close) => {
    let kind = s?.kind || 'target';
    $$('[data-kind]', el).forEach((b) => b.onclick = () => { kind = b.dataset.kind; $$('[data-kind]', el).forEach((x) => x.classList.toggle('sel', x === b)); });
    $('#simg', el).onclick = async () => { const u = await pickImage(); if (u) { image = u; $('#sprev', el).innerHTML = `<img class="thumb" src="${esc(u)}" alt="">`; } };
    $('#ssave', el).onclick = async () => {
      const body = { kind, goal_id: $('#sg', el).value || null, title: $('#st', el).value, note: $('#sn', el).value, style: $('#ss', el).value, image };
      try {
        const r = s ? await api(`/api/slides/${s.id}`, { method: 'PATCH', body }) : await api('/api/slides', { method: 'POST', body });
        close(); await refreshMe(); if (!s) handleAward(r, 'slide'); pageAlbum();
      } catch (e) { toast(e.message); }
    };
    if (s) $('#sdel', el).onclick = async () => { await api(`/api/slides/${s.id}`, { method: 'DELETE' }); close(); pageAlbum(); };
  });
}
function arriveForm(id) {
  let image = null;
  modal(`<h3>✓ Life caught up</h3><p class="muted">Attach the real photo beside the vision. A small celebration, held lightly.</p>
    <label>Date it arrived</label><input id="ad" type="date" value="${me.today}" max="${me.today}">
    <div id="aprev"></div><button class="small ghost mt" id="aimg">Add the real photo</button>
    <div class="row mt"><button class="green" id="asave">Mark Arrived</button><button class="ghost" data-close>Cancel</button></div>`,
  (el, close) => {
    $('#aimg', el).onclick = async () => { const u = await pickImage(); if (u) { image = u; $('#aprev', el).innerHTML = `<img class="thumb" src="${esc(u)}" alt="">`; } };
    $('#asave', el).onclick = async () => {
      try { const r = await api(`/api/slides/${id}/arrive`, { method: 'POST', body: { date: $('#ad', el).value, image } }); close(); await refreshMe(); handleAward(r, 'arrived'); pageAlbum(); }
      catch (e) { toast(e.message); }
    };
  });
}

// ---------- The Tale ----------
async function pageTale() {
  const t = await api('/api/tale');
  const lv = (n) => me.levels.find((l) => l.n === n);
  app.innerHTML = `<h1>The Tale</h1><p class="sub">${esc(t.book)}</p>
    ${companion('tale')}
    ${me.book === 2 ? `<div class="card glow"><h3>📜 Book II · Tufti</h3><p>Book I is complete. A sequel set in Tufti’s hall of the movie begins next — your character and everything you’ve earned carry over.</p><p class="muted small">Its chapters arrive in a future update of the app.</p></div>` : ''}
    <div class="card chapter"><details open><summary><h2>${esc(t.prologue.title)}</h2></summary><div class="prose">${esc(t.prologue.text)}</div></details></div>
    ${t.chapters.map((c) => c.sealed ? `
      <div class="card chapter sealed"><div class="spread"><div><div class="gate-num">Chapter ${c.n}</div><h3>${esc(c.title)}</h3></div><span class="seal">🔒</span></div>
      <p class="muted small">Unseals when you become ${esc(lv(c.n).name)}.</p></div>` : `
      <div class="card chapter"><details ${c.n === t.level && !c.trialDone ? 'open' : ''}><summary><div class="gate-num">Chapter ${c.n}</div><h2>${esc(c.title)}</h2></summary>
        <div class="prose">${esc(c.text)}</div>
        <div class="note mt"><b>✦ Trial · ${esc(c.trial.title)}</b><br>${esc(c.trial.prompt)}</div>
        ${c.trialDone ? `<p class="muted"><i>${esc(c.trialDone.response)}</i></p><span class="tag">✓ Walked</span>` : `
          <textarea data-trial-text="${c.n}"></textarea><button class="mt" data-trial="${c.n}">Walk the Trial (+30, once)</button>`}
      </details></div>`).join('')}`;
  $$('[data-trial]').forEach((b) => b.onclick = async () => {
    const n = b.dataset.trial;
    try { const r = await api(`/api/tale/${n}/trial`, { method: 'POST', body: { response: $(`[data-trial-text="${n}"]`).value } }); await refreshMe(); handleAward(r); pageTale(); }
    catch (e) { toast(e.message); }
  });
}

// ---------- Chronicle ----------
const ICONS = { intention: '🌅', reflection: '🪞', payout: '✦', levelup: '🎈', arrived: '✅', goal: '🌱', trial: '📜', quest: '🗝️' };
async function pageChronicle() {
  let rows = await api('/api/chronicle');
  const draw = () => {
    app.innerHTML = `<h1>Chronicle</h1><p class="sub">Your mirror journal — intentions, reflections, practice, wakings.</p>
      <div class="card">
        <div class="row" style="margin-bottom:6px"><label class="check" style="margin:0"><input type="checkbox" id="hidepay" ${pageChronicle.hide ? 'checked' : ''}> Hide practice payouts</label></div>
        ${rows.filter((r) => !(pageChronicle.hide && r.type === 'payout')).map((r) => `
        <div class="entry"><div class="ico">${ICONS[r.type] || '•'}</div><div style="flex:1">
          <div class="spread"><b>${esc(r.title)}</b><span class="muted small" style="white-space:nowrap">${esc(r.date ? niceDate(r.date) : '')}</span></div>
          ${r.body ? `<div class="body">${esc(r.body)}</div>` : ''}</div></div>`).join('') || '<p class="muted">Nothing recorded yet — and that’s perfectly fine.</p>'}
        ${rows.length && rows.length % 60 === 0 ? '<button class="small ghost mt" id="more">Earlier pages</button>' : ''}
      </div>`;
    $('#hidepay').onchange = (e) => { pageChronicle.hide = e.target.checked; draw(); };
    const more = $('#more');
    if (more) more.onclick = async () => { rows = rows.concat(await api(`/api/chronicle?before=${rows[rows.length - 1].id}`)); draw(); };
  };
  draw();
}

// ---------- Observatory ----------
async function pageObservatory() {
  const o = await api('/api/observatory');
  const byDate = new Map(o.days.map((d) => [d.date, d]));
  // 12 weeks, Monday-first, ending this week.
  const t = new Date(me.today + 'T12:00:00');
  const start = addDays(me.today, -((t.getDay() + 6) % 7) - 7 * 11);
  const cells = Array.from({ length: 84 }, (_, i) => {
    const d = addDays(start, i), r = byDate.get(d);
    const cls = d > me.today ? 'future' : r ? (r.morning && r.evening ? 'both' : r.morning ? 'am' : 'pm') : '';
    return `<div class="${cls} ${d === me.today ? 'today' : ''}" title="${d}${r ? '' : ' · unrecorded'}"></div>`;
  }).join('');
  const kindLabel = { goalAdmitted: 'Goals chosen', morningFrame: 'Morning frames', eveningMirror: 'Evening mirrors', quest: 'Invitations lived', slideComposed: 'Slides composed', slideArrived: 'Slides arrived', trial: 'Trials walked' };
  const stat = (v, l) => `<div class="card stat"><b>${v}</b><span>${l}</span></div>`;
  app.innerHTML = `<h1>Observatory</h1><p class="sub">Honest stats. Only what you chose to record.</p>
    ${companion('observatory')}
    <div class="grid2">
      ${stat(o.framesComposed, 'Frames composed')}${stat(o.mirrorsHeld, 'Mirrors held')}
      ${stat(o.questsCompleted, 'Invitations lived')}${stat(o.slides, 'Slides composed')}
      ${stat(o.arrived, 'Slides arrived')}${stat(o.trials, 'Trials walked')}
    </div>
    <div class="card">
      <h3>The last 12 weeks</h3>
      <p class="muted small">Blank days are simply unrecorded.</p>
      <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="muted small center">${d}</span>`).join('')}${cells}</div>
      <div class="legend"><span><i style="background:var(--gold)"></i>Frame</span><span><i style="background:var(--rose)"></i>Mirror</span><span><i style="background:linear-gradient(135deg,var(--gold) 50%,var(--rose) 50%)"></i>Both</span></div>
    </div>
    <div class="card">
      <h3>Where practice came from</h3>
      ${o.xpByKind.length ? o.xpByKind.map((k) => `<div class="spread entry"><span>${esc(kindLabel[k.kind] || k.kind)} <span class="muted small">× ${k.n}</span></span><b>${k.total}</b></div>`).join('') : '<p class="muted">Nothing yet.</p>'}
      <div class="spread mt"><span>Total practice</span><b>${o.xp}</b></div>
      ${o.firstRecorded ? `<p class="muted small">First recorded day: ${niceDate(o.firstRecorded)} · ${o.daysRecorded} day${o.daysRecorded === 1 ? '' : 's'} recorded</p>` : ''}
    </div>`;
}

// ---------- Realm & Hall ----------
function pageRealm() {
  const n = me.level.n;
  app.innerHTML = `<h1>Realm & Hall</h1><p class="sub">The alternatives space, and the forms you’ve woken into.</p>
    <div class="card map" style="padding:8px">${realmMap(me.levels, n)}</div>
    <div class="card">
      <h2 class="center">The Hall</h2>
      <div class="big-portrait portrait current"><div class="frame">${portraitFrame(n, 'big')}${portraitImg(n)}</div></div>
      <h3 class="center mt">${esc(me.level.name)}</h3>
      <p class="muted small center">Same person, growing radiance.</p>
      <div class="row" style="justify-content:center"><button class="small" id="basePhoto">${me.settings.portraitBase ? 'Change your photo' : 'Add a photo of you'}</button></div>
      <p class="muted small center">Tap any form you’ve reached to give it its own image (for example, one made later with an image AI).</p>
      <div class="portraits mt">${me.levels.map((l) => `
        <div class="portrait ${l.n > n ? 'locked' : ''} ${l.n === n ? 'current' : ''}" ${l.n <= n ? `data-form="${l.n}" role="button" tabindex="0"` : ''}>
          <div class="frame">${portraitFrame(l.n, 'g')}${l.n <= n ? portraitImg(l.n) : '<div class="ph">🔒</div>'}</div>
          <div>${esc(l.name.replace('The ', ''))}</div><div class="muted">${l.xp}</div></div>`).join('')}</div>
    </div>`;
  $('#basePhoto').onclick = async () => { const u = await pickImage(); if (u) { await api('/api/settings', { method: 'PUT', body: { portraitBase: u } }); await refreshMe(); pageRealm(); } };
  $$('[data-form]').forEach((el) => el.onclick = () => {
    const lv = Number(el.dataset.form);
    modal(`<h3>${esc(me.levels[lv - 1].name)}</h3>
      <div class="big-portrait portrait"><div class="frame">${portraitFrame(lv, 'm')}${portraitImg(lv)}</div></div>
      <div class="row mt"><button id="fset">Set an image for this form</button>${me.settings.portraits?.[lv] ? '<button class="ghost" id="fclr">Use my base photo</button>' : ''}<button class="ghost" data-close>Close</button></div>`,
    (m, close) => {
      $('#fset', m).onclick = async () => { const u = await pickImage(); if (u) { await api('/api/settings', { method: 'PUT', body: { portrait: { level: lv, image: u } } }); close(); await refreshMe(); pageRealm(); } };
      const c = $('#fclr', m); if (c) c.onclick = async () => { await api('/api/settings', { method: 'PUT', body: { portrait: { level: lv, image: null } } }); close(); await refreshMe(); pageRealm(); };
    });
  });
}

// ---------- More & Settings ----------
function pageMore() {
  app.innerHTML = `<h1>More</h1>
    <div class="card menu">
      <a href="#/observatory"><span>🔭</span>Observatory</a>
      <a href="#/chronicle"><span>📔</span>Chronicle</a>
      <a href="#/realm"><span>🗺️</span>Realm & Hall</a>
      <a href="#/stepzero"><span>🌱</span>Step Zero · choose a goal</a>
      <a href="#/settings"><span>⚙️</span>Settings</a>
    </div>`;
}
function pageSettings() {
  app.innerHTML = `<h1>Settings</h1>
    <div class="card"><h3>Your companion</h3>
      <label>Name</label><input id="cn" type="text" value="${esc(me.settings.companionName)}">
      <button class="mt small" id="cns">Save name</button></div>
    <div class="card"><h3>Password</h3>
      <label>Current</label><input id="pc" type="password" autocomplete="current-password">
      <label>New (10+ characters)</label><input id="pn" type="password" autocomplete="new-password">
      <button class="mt small" id="pws">Change password</button><div class="err" id="perr"></div></div>
    <div class="card"><h3>Your data</h3><p class="muted small">Everything lives on your server. Export a full copy any time.</p>
      <a class="btn small ghost" href="/api/export" download>Download export (JSON)</a></div>
    <div class="card"><button class="ghost block" id="out">Sign out</button></div>`;
  $('#cns').onclick = async () => { await api('/api/settings', { method: 'PUT', body: { companionName: $('#cn').value } }); await refreshMe(); toast('Saved.'); };
  $('#pws').onclick = async () => {
    try { await api('/api/password', { method: 'POST', body: { current: $('#pc').value, next: $('#pn').value } }); toast('Password changed.'); $('#pc').value = $('#pn').value = ''; $('#perr').textContent = ''; }
    catch (e) { $('#perr').textContent = e.message; }
  };
  $('#out').onclick = async () => { await api('/api/logout', { method: 'POST' }); me = null; renderChrome(); location.hash = '#/login'; start(); };
}

// ---------- router ----------
const ROUTES = { board: pageBoard, stepzero: pageStepZero, checkin: pageCheckin, album: pageAlbum, tale: pageTale, chronicle: pageChronicle, observatory: pageObservatory, realm: pageRealm, more: pageMore, settings: pageSettings };
async function route() {
  if (!me) return;
  const r = location.hash.split('/')[1]?.split('#')[0] || 'board';
  renderChrome();
  try { await (ROUTES[r] || pageBoard)(); } catch (e) { if (e.message !== 'Signed out') app.innerHTML = `<div class="card"><p>${esc(e.message)}</p></div>`; }
  app.focus({ preventScroll: true });
}
window.addEventListener('hashchange', () => { if (location.hash === '#/login') return; window.scrollTo(0, 0); route(); });

async function start() {
  $('#sky').innerHTML = SKY;
  const st = await api('/api/state');
  if (!st.setup) { me = null; renderChrome(); return pageSetup(); }
  if (!st.authed) { me = null; renderChrome(); return pageLogin(); }
  await refreshMe();
  if (!me.goals.length && !me.settings.stepZeroDone && !location.hash.startsWith('#/stepzero')) location.hash = '#/stepzero';
  else if (location.hash === '#/login' || !location.hash) location.hash = '#/board';
  route();
}
start();
