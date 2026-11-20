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
  life: { label: 'My whole life', icon: '🌈' },
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
        <a class="btn ${ci.morning?.complete ? 'ghost' : ''}" href="#/checkin">🌅 ${ci.morning?.complete ? 'Frame on' : 'Morning frame'}</a>
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
      <div class="spread"><h3>Your goals</h3><a class="btn small ghost" href="#/stepzero">+ ${active.some((g) => g.is_main) ? 'Extra goal' : 'Main goal'}</a></div>
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
  $$('[data-main]').forEach((b) => b.onclick = async () => { await api(`/api/goals/${b.dataset.main}/main`, { method: 'POST' }); await refreshMe(); pageBoard(); });
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
    ${g.is_main ? '<span class="tag gold">★ Main goal</span>' : ''}
    <b>${esc(g.title)}</b><div class="muted small">${esc(g.scene || '')}</div>
    ${g.freiling ? `<div class="small">💝 I give: ${esc(g.freiling)}</div>` : ''}
    <div class="row mt">${g.is_main ? '' : `<button class="small ghost" data-main="${g.id}">Make main</button>`}<button class="small ghost" data-release="${g.id}">Release</button></div></div></div>`;
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
// Follows Steps I–V, Ch. X "Goals and Doors": one main goal (others ride along as attributes),
// the foreign-goal tests, inner inhibition vs inner tension, and doors that find themselves.
let sz = null;
function freshSz() { return { step: 1, area: null, title: '', origin: '', scene: '', freiling: '', path: '', checks: {}, branch: null, sub: null }; }
const FOREIGN_SIGNS = ['feels punishing, coerced, or like an obligation', 'comes dressed as fashion or prestige', 'lures you by seeming unattainable', 'is about proving something to yourself or others', 'was imposed by someone else', 'mainly improves someone else’s wellbeing', 'makes you feel uneasy'];
function pageStepZero() {
  if (!sz) sz = freshSz();
  const intro = !me.goals.length && !me.settings.stepZeroDone;
  if (intro && sz.step === 1 && !sz.seenIntro) return stepZeroIntro();
  const isMain = !me.goals.some((g) => g.status === 'active' && g.is_main);
  const total = 9;
  const s = sz.step;
  const has = (a) => me.goals.some((g) => g.status === 'active' && g.area === a);
  const note = (t, cls = '') => `<div class="note ${cls}">${t}</div>`;
  let body = '';

  if (s === 1) {
    const areas = Object.entries(AREAS).filter(([k]) => isMain || k !== 'life');
    body = `<div class="gate-num">${isMain ? 'Your main goal' : 'An extra goal'}</div>
      <h2>${isMain ? 'Where does your main goal live?' : 'Which part of life is this one in?'}</h2>
      ${isMain ? note('The book: <i>settle on one main goal. Achieve it, and your other desires follow behind it.</i> If nothing specific comes yet, start with “comfort and wellbeing” and ask what that means to you.')
        : note('Many wishes are really <b>attributes</b> that arrive with your main goal. Add an extra goal only if it stands on its own.')}
      <div class="choices">${areas.map(([k, a]) => `<button class="choice" data-area="${k}"><b>${a.icon} ${a.label}</b>${k === 'life' ? '<span class="muted small">The life that would feel like a continual holiday</span>' : has(k) ? '<span class="muted small">You already hold a goal here</span>' : ''}</button>`).join('')}</div>`;
  } else if (s === 2) {
    body = `<div class="gate-num">Name it</div>
      <h2>${isMain ? 'What do you want most out of life?' : 'What do you wish for?'}</h2>
      <p class="muted">${isMain ? 'What would make your life happy and joyful — like one continual holiday?' : 'Say it plainly, in your own words.'}</p>
      ${note('Don’t think about how prestigious or realistic it is, or the means to get there. Don’t be shy: if you want a boat, what about a yacht? Order whatever your heart wants.')}
      <input id="t" type="text" value="${esc(sz.title)}" placeholder="e.g. A home full of light by the water">
      <button class="block mt" id="next">Continue</button>`;
  } else if (s === 3) {
    body = `<div class="gate-num">Gate 1 of 6 · Is it mine?</div>
      <h2>Do I really need it? But seriously now — do I really need it?</h2>
      <p class="muted">And: if nobody would ever know, would you still want it?</p>
      <details class="small"><summary class="muted">▸ Signs of a foreign goal</summary><p class="small">A foreign goal ${FOREIGN_SIGNS.join('; ')}.</p></details>
      <div class="choices">
        <button class="choice" data-c="yes"><b>Yes — I really need it, even in secret</b></button>
        <button class="choice" data-c="unsure"><b>I’m not sure</b></button>
        <button class="choice" data-c="no"><b>Honestly, no</b></button>
      </div>
      ${sz.branch === 'unsure' ? `<h3>Try letting it go for a moment.</h3><p class="muted">Imagine dropping this wish right now. What do you feel?</p>
        <div class="choices">
          <button class="choice ${sz.sub === 'relief' ? 'sel' : ''}" data-sub="relief"><b>Relief</b>Something lighter</button>
          <button class="choice ${sz.sub === 'protest' ? 'sel' : ''}" data-sub="protest"><b>Indignation</b>I want to protest</button>
        </div>
        ${sz.sub === 'relief' ? note('Relief means it was probably a foreign goal. Thank you for noticing — that’s a pendulum you won’t be feeding.') + `<div class="row"><button class="small ghost" id="back2">Name a different wish</button><button class="small gold" id="letgo">Let it go</button></div>` : ''}
        ${sz.sub === 'protest' ? note('Wanting to protest means the goal may well be yours.', 'green') + `<button class="block" id="mineYes">Continue</button>` : ''}` : ''}
      ${sz.branch === 'no' ? note('Thank you for being honest. A wish that isn’t yours would only feed a pendulum.') + `
        <div class="row"><button class="small ghost" id="back2">Name a different wish</button><button class="small gold" id="letgo">Let it go</button></div>` : ''}`;
  } else if (s === 4) {
    body = `<div class="gate-num">Gate 2 of 6 · An end, not a means?</div>
      <h2>Is “${esc(sz.title)}” the scene itself — or a way to buy a scene?</h2>
      <p class="muted">Money can be neither a goal nor a means — it’s an attribute that comes along the way. The heart can’t picture money; it needs to know what it would buy.</p>
      <div class="choices">
        <button class="choice" data-c="end"><b>It’s the scene itself</b>The life I actually want to live</button>
        <button class="choice" data-c="means"><b>It’s a means</b>Money, a title, a job, recognition…</button>
      </div>
      ${sz.branch === 'means' ? `<label>What life-scene was it meant to buy?</label>
        <textarea id="endScene" placeholder="If you had it, what would you be doing on an ordinary Tuesday?"></textarea>
        <button class="block mt" id="useEnd">Make that my goal</button>` : ''}`;
  } else if (s === 5) {
    body = `<div class="gate-num">Gate 3 of 6 · The comfort test</div>
      <h2>Imagine it’s already yours and all this is behind you.</h2>
      <p class="muted">See it from inside your own eyes, in the present tense. Then stop thinking about it and listen to your heart.</p>
      <textarea id="scene" placeholder="I’m sitting… I can hear… I feel…">${esc(sz.scene)}</textarea>
      <h3 class="mt">How comfortable do you feel inside it?</h3>
      <div class="choices">
        <button class="choice" data-c="comfy"><b>Comfortable</b>Like home</button>
        <button class="choice" data-c="shy"><b>A little shy</b>“Can this really be for me?”</button>
        <button class="choice" data-c="heavy"><b>Heavy</b>Fear, burden, urgency, or obligation mixed in</button>
      </div>
      ${sz.branch === 'shy' ? note('That’s <b>inner inhibition</b> — the natural shyness of the unfamiliar, not a “no.” Slides will widen your comfort zone. You deserve the absolute best.', 'green') + `<button class="block" id="shyOk">Continue</button>` : ''}
      ${sz.branch === 'heavy' ? note('That’s <b>inner tension</b> — the heart’s clear “no.” Slides can’t remove it. No need to decide in a hurry, though.') + `
        <h3>Where does the heaviness come from?</h3>
        <div class="choices">
          <button class="choice ${sz.sub === 'goal' ? 'sel' : ''}" data-sub="goal"><b>The goal itself</b></button>
          <button class="choice ${sz.sub === 'hard' ? 'sel' : ''}" data-sub="hard"><b>Only how hard it seems</b></button>
        </div>
        ${sz.sub === 'goal' ? note('Then it’s likely a foreign goal. Reshape it until the picture feels like home, or let it go.') + `<div class="row"><button class="small ghost" id="back2">Reshape the wish</button><button class="small gold" id="letgo">Let it go</button></div>` : ''}
        ${sz.sub === 'hard' ? note('Then it sits beyond your current comfort zone, or the route you imagined is a foreign door. Drop the route: slides will widen the zone, and outer intention will find the door.', 'green') + `<button class="block" id="hardOk">Continue</button>` : ''}` : ''}`;
  } else if (s === 6) {
    body = `<div class="gate-num">Gate 4 of 6 · Importance</div>
      <h2>Accept from the start that it might not happen. Can you hold it calmly now?</h2>
      <p class="muted">Desire and importance block a goal; the will to have lets it through. Take it calmly, the way you take post from your letter box.</p>
      <div class="choices">
        <button class="choice" data-c="calm"><b>Yes — calm, no insistence</b></button>
        <button class="choice" data-c="heavyImp"><b>It feels like I can’t be happy without it</b></button>
      </div>
      ${sz.branch === 'heavyImp' ? note('That’s excess importance, and balance forces push back against it. Try this: let yourself accept that it might not work out. Notice that you’d still be fine. Then keep the wish, without the weight, and simply act.') + `
        <div class="row"><button class="small" id="calmNow">I can hold it calmly now</button><button class="small gold" id="letgo">Set it aside for now</button></div>` : ''}`;
  } else if (s === 7) {
    const rel = sz.area === 'relationships';
    body = `<div class="gate-num">Gate 5 of 6 · Your own life</div>
      <h2>Is this about your life — not changing, winning over, or controlling someone?</h2>
      <p class="muted">Don’t try to change others. Don’t try to change yourself either.</p>
      <div class="choices">
        <button class="choice" data-c="own"><b>Yes, it’s my own life</b></button>
        <button class="choice" data-c="other"><b>It involves changing someone</b></button>
      </div>
      ${(sz.branch === 'other' || (rel && sz.branch === 'own')) ? `
        ${note('<b>Frailing:</b> let go of the intention to <i>get</i> and replace it with the intention to <i>give</i>. As a result, you receive what you let go of.')}
        <label>What will you give?</label>
        <textarea id="freiling" placeholder="Sincere interest, warmth, a lift to their sense of self-worth…">${esc(sz.freiling)}</textarea>
        ${sz.branch === 'other' ? `<label>Your goal, reshaped around your own life</label><input id="reshaped" type="text" value="${esc(sz.title)}">` : ''}
        <button class="block mt" id="freilingNext">Continue</button>` : ''}`;
  } else if (s === 8) {
    body = `<div class="gate-num">Gate 6 of 6 · Your door</div>
      <h2>Do you see a path to it that you’d walk willingly?</h2>
      <p class="muted">You don’t need the door yet. Settle the goal first. The door is the path you’d take with inspiration, doing what comes willingly and easily.</p>
      <div class="choices">
        <button class="choice" data-c="door"><b>Yes — a path I’d enjoy</b></button>
        <button class="choice" data-c="nodoor"><b>I can’t see the door yet</b></button>
        <button class="choice" data-c="toll"><b>The only path I see feels like a toll</b></button>
      </div>
      ${sz.branch === 'nodoor' ? note('That’s fine. If you can’t see the path, hold the target slide. Outer intention will open your door.', 'green') + `<button class="block" id="noDoorOk">Continue</button>` : ''}
      ${sz.branch === 'door' || sz.branch === 'toll' ? `
        ${sz.branch === 'toll' ? note('Then it’s the wrong door, not the wrong goal. Let that route go — the right door feels inspiring.') : ''}
        <label>${sz.branch === 'toll' ? 'Another door you might enjoy (optional)' : 'What draws you along that path?'}</label>
        <textarea id="path">${esc(sz.path)}</textarea>
        <p class="muted small">Don’t slam any doors or burn any bridges. Keep a safety net while the new door opens.</p>
        <button class="block mt" id="pathNext">Continue</button>` : ''}`;
  } else if (s === 9) {
    const a = AREAS[sz.area] || AREAS.other;
    body = `<div class="gate-num">${isMain ? 'Your main goal' : 'An extra goal'} · all six gates</div>
      <h2>${a.icon} ${esc(sz.title)}</h2>
      ${sz.origin ? `<p class="muted small">Found beneath: “${esc(sz.origin)}”</p>` : ''}
      <p><i>${esc(sz.scene)}</i></p>
      ${sz.freiling ? `<p>💝 I give: ${esc(sz.freiling)}</p>` : ''}
      ${sz.path ? `<p>🚪 My door: ${esc(sz.path)}</p>` : '<p class="muted small">🚪 Door: not yet visible. Outer intention will show it.</p>'}
      ${note('Keep no route in the target slide — you already have what you want. Turn it in your mind often, and let the door find itself.', 'green')}
      <button class="block green" id="admit">Admit this goal</button>`;
  } else if (s === 10) {
    const missing = ['relationships', 'work', 'home', 'body'].filter((k) => !has(k));
    body = `${companion('goalAdmitted')}
      <h2>Anything else?</h2>
      <p class="muted">Reaching your main goal tends to bring your other wishes with it as attributes. Add an extra goal only if one truly stands on its own${missing.length ? ` (perhaps in ${missing.map((k) => AREAS[k].label.toLowerCase()).join(', ')})` : ''}.</p>
      <div class="row"><button class="ghost" id="another">Add an extra goal</button><button id="finish">That’s enough for now</button></div>`;
  }

  app.innerHTML = `<h1>Step Zero</h1><p class="sub">Choosing goals that are truly yours.</p>
    ${s < 10 ? companion('stepzero', s) : ''}
    <div class="card">${s < 10 ? `<div class="steps">${Array.from({ length: total }, (_, i) => `<i class="${i < s ? 'on' : ''}"></i>`).join('')}</div>` : ''}${body}
    ${s > 1 && s < 10 ? `<button class="small ghost mt" id="prev">← Back</button>` : ''}</div>`;

  const go = (n) => { sz.step = n; sz.branch = null; sz.sub = null; pageStepZero(); window.scrollTo(0, 0); };
  const redraw = () => { const y = window.scrollY; pageStepZero(); window.scrollTo(0, y); };
  const bind = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  bind('#prev', () => go(s - 1));
  bind('#back2', () => go(2));
  bind('#letgo', () => { toast(line('release')); sz = { ...freshSz(), seenIntro: true }; pageStepZero(); });
  $$('[data-area]').forEach((b) => b.onclick = () => { sz.area = b.dataset.area; go(2); });
  bind('#next', () => { const v = $('#t').value.trim(); if (!v) return toast('Give it a few words.'); sz.title = v; go(3); });
  $$('[data-c]').forEach((b) => b.onclick = () => {
    const c = b.dataset.c;
    const scene = $('#scene'); if (scene) sz.scene = scene.value.trim();
    if (c === 'yes') { sz.checks.mine = true; return go(4); }
    if (c === 'end') { sz.checks.end = true; return go(5); }
    if (['comfy', 'shy', 'heavy'].includes(c) && !sz.scene) return toast('Write the scene first — just a few lines.');
    if (c === 'comfy') { sz.checks.slide = true; return go(6); }
    if (c === 'calm') { sz.checks.calm = true; return go(7); }
    if (c === 'own' && sz.area !== 'relationships') { sz.checks.ownLife = true; return go(8); }
    sz.branch = c; sz.sub = null; redraw();
  });
  $$('[data-sub]').forEach((b) => b.onclick = () => { sz.sub = b.dataset.sub; redraw(); });
  bind('#mineYes', () => { sz.checks.mine = true; go(4); });
  bind('#useEnd', () => {
    const v = $('#endScene').value.trim(); if (!v) return toast('Describe the scene it was meant to buy.');
    sz.origin = sz.title; sz.title = v.length > 90 ? v.slice(0, 90) + '…' : v; sz.scene = v; sz.checks.end = true; go(5);
  });
  bind('#shyOk', () => { sz.checks.slide = true; go(6); });
  bind('#hardOk', () => { sz.checks.slide = true; go(6); });
  bind('#calmNow', () => { sz.checks.calm = true; go(7); });
  bind('#freilingNext', () => {
    sz.freiling = $('#freiling').value.trim();
    const re = $('#reshaped');
    if (re) { if (!sz.freiling) return toast('Name what you’ll give.'); sz.title = re.value.trim() || sz.title; }
    sz.checks.ownLife = true; go(8);
  });
  bind('#noDoorOk', () => { sz.path = ''; sz.checks.door = true; go(9); });
  bind('#pathNext', () => { sz.path = $('#path').value.trim(); sz.checks.door = true; go(9); });
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
      <h2>A goal that is truly yours</h2>
      <p>In Transurfing you don’t fight for a goal. You find your own, take it calmly with the will to have, and move toward it while outer intention does its part.</p>
      <p>You’ll start with <b>one main goal</b> — the one that would make life feel like a continual holiday. Reaching it tends to bring your other wishes along as attributes. You can add extra goals afterwards if any truly stand on their own.</p>
      <p>Each goal passes six gentle gates: is it <b>mine</b>, an <b>end</b>, <b>comfortable</b> to live in, held <b>without importance</b>, about <b>my own life</b>, and is there a <b>door</b> (which can wait)?</p>
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
      <div class="spread"><h2>🌅 The frame</h2>${m.complete ? '<span class="tag">On</span>' : ''}</div>
      <p class="muted small">1 · Wake up in the movie</p>
      <p>For a moment, step back and watch: you are in the film, not swept along by it. Calm and clear, a participating observer.</p>
      <label class="check"><input type="checkbox" id="presence" ${m.presence ? 'checked' : ''}> I woke up for a moment and observed.</label>
      <p class="muted small mt">2 · Switch on your frame</p>
      <p class="small">A frame is one small, telling moment from your target slide: a flash image and the feeling that comes with it, with a short name.</p>
      ${me.frames.length ? `<select id="framePick"><option value="">Choose a frame…</option>${me.frames.map((f) => `<option value="${esc(f.frame)}">${esc(f.frame)}</option>`).join('')}</select>`
        : `<p class="muted small">Tip: give a target slide a frame name in the <a href="#/album">Slide Album</a> to pick it here.</p>`}
      ${active.length ? `<select id="goal" class="mt"><option value="">For any goal</option>${active.map((g) => `<option value="${g.id}" ${m.goal_id === g.id ? 'selected' : ''}>${g.is_main ? '★ ' : ''}${esc(g.title)}</option>`).join('')}</select>` : ''}
      <textarea id="intention" class="mt" placeholder="The frame’s name, and what you see and feel in that flash — as if it’s already yours">${esc(m.intention || '')}</textarea>
      <label class="check"><input type="checkbox" id="released" ${m.released ? 'checked' : ''}> I switched it on for an instant, like a light, without straining. I’ll turn it on again whenever it naturally comes to mind.</label>
      <button class="block" id="saveM">${m.complete ? 'Update the frame' : 'Switch on the frame'}</button>
    </div>
    <div class="card ${e.complete ? 'glow' : ''}" id="evening">
      <div class="spread"><h2>🪞 Mirror work</h2>${e.complete ? '<span class="tag">Held</span>' : ''}</div>
      <label>What did the mirror reflect back today?</label>
      <p class="muted small">Any reflection can be taken as positive. Dwell on what you want, not what you don’t.</p>
      <textarea id="reflection" placeholder="Moments, moods, small turns…">${esc(e.reflection || '')}</textarea>
      <label>Coordinating intention <span class="muted">— did anything go against the plan? How might it be for the best?</span></label>
      <textarea id="turn" style="min-height:70px" placeholder="So it should be, because…">${esc(e.turn || '')}</textarea>
      <label>Answers or synchronicities <span class="muted">(no need to find any — the mirror answers with a delay)</span></label>
      <textarea id="sync" style="min-height:70px">${esc(e.synchronicities || '')}</textarea>
      <label class="check"><input type="checkbox" id="coord" ${e.coordination ? 'checked' : ''}> My amalgam: “My world takes care of me.”</label>
      <button class="block" id="saveE">${e.complete ? 'Update the mirror' : 'Hold the mirror'}</button>
    </div>`;

  $$('[data-day]').forEach((b) => b.onclick = () => { ciDate = b.dataset.day; pageCheckin(); });
  const fp = $('#framePick');
  if (fp) fp.onchange = () => { if (fp.value && !$('#intention').value.includes(fp.value)) $('#intention').value = fp.value + ($('#intention').value ? ' — ' + $('#intention').value : ' — '); };
  $('#saveM').onclick = async () => {
    const body = { presence: $('#presence').checked, intention: $('#intention').value, released: $('#released').checked, goal_id: $('#goal')?.value || null };
    if (!body.presence || !body.intention.trim() || !body.released) toast('Saved. The frame counts once you’ve observed, named it, and switched it on.');
    const r = await api(`/api/checkin/${ciDate}/morning`, { method: 'PUT', body });
    await refreshMe(); if (r.entry.complete) handleAward(r, 'morningDone'); pageCheckin();
  };
  $('#saveE').onclick = async () => {
    const body = { reflection: $('#reflection').value, turn: $('#turn').value, synchronicities: $('#sync').value, coordination: $('#coord').checked };
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
    <p class="sub">Target slides of the goal already achieved, and process slides of the step you’re on.</p>
    ${companion('slide')}
    <button class="block" id="newSlide" style="margin-bottom:14px">+ Compose a slide</button>
    <div class="slides">${slides.map((s) => `
      <div class="card slide ${s.comfort === 'revisit' ? '' : ''}">
        <div class="pic">${s.arrived_at ? '<span class="arrived">✓ Arrived ' + esc(niceDate(s.arrived_at)) + '</span>' : ''}
          ${s.arrived_image ? `<div class="duo">${s.image ? `<img src="${esc(s.image)}" alt="Vision">` : '<div></div>'}<img src="${esc(s.arrived_image)}" alt="Real photo"></div>`
            : s.image ? `<img src="${esc(s.image)}" alt="">` : (s.kind === 'process' ? '🚶' : '🎞️')}</div>
        <div class="body">
          <div class="row"><span class="tag ${s.kind === 'process' ? 'rose' : 'gold'}">${s.kind === 'process' ? 'Process slide' : 'Target slide'}</span>${s.frame ? `<span class="tag">🔦 ${esc(s.frame)}</span>` : ''}${s.style ? `<span class="tag">${esc(s.style)}</span>` : ''}</div>
          <h3 class="mt">${esc(s.title || 'Untitled slide')}</h3>
          ${gName(s.goal_id) ? `<div class="muted small">${esc(gName(s.goal_id))}</div>` : ''}
          ${s.note ? `<p><i>${esc(s.note)}</i></p>` : ''}
          ${s.comfort === 'revisit' ? `<div class="note">This slide asked to be looked at again. A little shyness (“can this be for me?”) eases as you keep turning it. Heavy tension is the heart’s “no”: <a href="#/stepzero">revisit Step Zero</a> or reshape it.</div>` : ''}
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
    <div class="note small">Live it, don’t just look at it: be <b>inside</b> the scene. Turn it often and add a detail each time. Never copy an image from someone else’s life.</div>
    <div class="choices" style="grid-template-columns:1fr 1fr">
      <button class="choice ${(!s || s.kind === 'target') ? 'sel' : ''}" data-kind="target"><b>🎞️ Target</b>The goal already achieved — no route in it</button>
      <button class="choice ${s?.kind === 'process' ? 'sel' : ''}" data-kind="process"><b>🌱 Process</b>The step you’re on now, taking shape and growing</button>
    </div>
    <label>Goal</label><select id="sg"><option value="">—</option>${active.map((g) => `<option value="${g.id}" ${s?.goal_id === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>
    <label>Title</label><input id="st" type="text" value="${esc(s?.title || '')}" placeholder="Morning on the porch">
    <label>Intention note (present tense)</label><textarea id="sn" placeholder="I’m sipping coffee while the light comes up over the water…">${esc(s?.note || '')}</textarea>
    <div id="frameWrap"><label>Frame name <span class="muted">(target slides — a short name for one telling moment)</span></label><input id="sf" type="text" value="${esc(s?.frame || '')}" placeholder="Porch at dawn"></div>
    <label>Style</label><select id="ss">${['Storybook', 'Photorealistic'].map((x) => `<option ${s?.style === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label>Image</label><div id="sprev">${image ? `<img class="thumb" src="${esc(image)}" alt="">` : ''}</div>
    <button class="small ghost mt" id="simg">${image ? 'Change image' : 'Upload an image'}</button>
    <div class="row mt"><button id="ssave">${s ? 'Save' : 'Compose'}</button>${s ? '<button class="ghost" id="sdel">Remove</button>' : ''}<button class="ghost" data-close>Cancel</button></div>`,
  (el, close) => {
    let kind = s?.kind || 'target';
    const showFrame = () => $('#frameWrap', el).classList.toggle('hidden', kind !== 'target');
    showFrame();
    $$('[data-kind]', el).forEach((b) => b.onclick = () => { kind = b.dataset.kind; $$('[data-kind]', el).forEach((x) => x.classList.toggle('sel', x === b)); showFrame(); });
    $('#simg', el).onclick = async () => { const u = await pickImage(); if (u) { image = u; $('#sprev', el).innerHTML = `<img class="thumb" src="${esc(u)}" alt="">`; } };
    $('#ssave', el).onclick = async () => {
      const body = { kind, goal_id: $('#sg', el).value || null, title: $('#st', el).value, note: $('#sn', el).value, style: $('#ss', el).value, image, frame: kind === 'target' ? $('#sf', el).value : '' };
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
