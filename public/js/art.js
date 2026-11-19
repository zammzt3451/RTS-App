// Hand-drawn SVG art for the world of the reel. All original.

const balloon = (x, y, s, c1, c2, cls) => `
  <g class="balloon ${cls}" transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 -40 C 26 -40 34 -14 22 6 C 14 19 7 26 5 34 L -5 34 C -7 26 -14 19 -22 6 C -34 -14 -26 -40 0 -40 Z" fill="${c1}"/>
    <path d="M0 -40 C 10 -40 13 -14 8 6 C 5 19 3 26 2 34 L -2 34 C -3 26 -5 19 -8 6 C -13 -14 -10 -40 0 -40 Z" fill="${c2}" opacity=".85"/>
    <path d="M-5 34 L -6 44 M5 34 L 6 44" stroke="#7a4b2a" stroke-width="1"/>
    <rect x="-7" y="44" width="14" height="9" rx="2" fill="#8a5a33"/>
  </g>`;

export const SKY = `
<svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7b1b6a"/>
      <stop offset=".28" stop-color="#c2185b"/>
      <stop offset=".52" stop-color="#f2785c"/>
      <stop offset=".7" stop-color="#f7b24a"/>
      <stop offset=".82" stop-color="#ffe08a"/>
    </linearGradient>
    <radialGradient id="sun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffe07a"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fbf7f"/><stop offset="1" stop-color="#1d7a4b"/></linearGradient>
    <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e9d6a"/><stop offset="1" stop-color="#11593a"/></linearGradient>
  </defs>
  <rect width="400" height="800" fill="url(#sk)"/>
  <g fill="#fff" opacity=".7">
    <circle cx="40" cy="60" r="1.2"/><circle cx="120" cy="30" r="1"/><circle cx="300" cy="50" r="1.4"/>
    <circle cx="360" cy="110" r="1"/><circle cx="210" cy="90" r=".9"/><circle cx="80" cy="150" r=".8"/>
  </g>
  <circle cx="250" cy="560" r="150" fill="url(#sun)"/>
  <circle cx="250" cy="560" r="46" fill="#fff3b8" opacity=".95"/>
  <g fill="none" stroke-width="13" opacity=".55" stroke-linecap="round">
    <path d="M -40 640 A 260 260 0 0 1 480 640" stroke="#ff5a7a"/>
    <path d="M -27 640 A 247 247 0 0 1 467 640" stroke="#ff9c4a"/>
    <path d="M -14 640 A 234 234 0 0 1 454 640" stroke="#ffe066"/>
    <path d="M -1 640 A 221 221 0 0 1 441 640" stroke="#7ed67e"/>
    <path d="M 12 640 A 208 208 0 0 1 428 640" stroke="#6ab7ff"/>
    <path d="M 25 640 A 195 195 0 0 1 415 640" stroke="#a681ff"/>
  </g>
  <g fill="#fff" opacity=".55">
    <ellipse cx="80" cy="300" rx="60" ry="12"/><ellipse cx="110" cy="292" rx="34" ry="12"/>
    <ellipse cx="330" cy="230" rx="52" ry="10"/><ellipse cx="310" cy="224" rx="28" ry="10"/>
  </g>
  ${balloon(70, 220, 1.1, '#ff5a7a', '#ffd166', 'b1')}
  ${balloon(320, 330, .8, '#7ed6c9', '#fff1a8', 'b2')}
  ${balloon(180, 140, .6, '#b388ff', '#ffb3c7', 'b3')}
  ${balloon(370, 470, .5, '#ffd166', '#ff8a5c', 'b1')}
  <path d="M0 620 C 80 570 160 600 230 610 C 300 620 350 580 400 590 L 400 800 L 0 800 Z" fill="url(#h1)"/>
  <path d="M0 690 C 90 640 170 690 260 670 C 330 655 370 680 400 670 L 400 800 L 0 800 Z" fill="url(#h2)"/>
  <path d="M0 750 C 120 715 240 760 400 730 L 400 800 L 0 800 Z" fill="#0e4d32"/>
</svg>`;

// The companion: a tiny sage in a star-stitched rainbow robe, with round gold spectacles and a hand mirror.
export const COMPANION = `
<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your companion">
  <defs>
    <linearGradient id="robe" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff5a7a"/><stop offset=".25" stop-color="#ff9c4a"/><stop offset=".45" stop-color="#ffd166"/>
      <stop offset=".65" stop-color="#5cc28b"/><stop offset=".82" stop-color="#6ab7ff"/><stop offset="1" stop-color="#a681ff"/>
    </linearGradient>
    <radialGradient id="glass" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bfe3ff"/></radialGradient>
  </defs>
  <path d="M30 148 C 26 110 34 84 60 78 C 86 84 94 110 90 148 Z" fill="url(#robe)"/>
  <g fill="#fff" opacity=".95">
    <path d="M45 105 l2 5 5 .5 -4 3 1.5 5 -4.5 -3 -4.5 3 1.5 -5 -4 -3 5 -.5z" transform="scale(.7) translate(20 45)"/>
    <path d="M70 120 l2 5 5 .5 -4 3 1.5 5 -4.5 -3 -4.5 3 1.5 -5 -4 -3 5 -.5z" transform="scale(.6) translate(50 80)"/>
    <circle cx="52" cy="132" r="1.6"/><circle cx="76" cy="100" r="1.4"/><circle cx="62" cy="118" r="1.2"/>
  </g>
  <ellipse cx="60" cy="56" rx="24" ry="26" fill="#f4c7a1"/>
  <ellipse cx="52" cy="40" rx="8" ry="4" fill="#fff" opacity=".45"/>
  <ellipse cx="35" cy="58" rx="4" ry="6" fill="#ecb48c"/><ellipse cx="85" cy="58" rx="4" ry="6" fill="#ecb48c"/>
  <g fill="none" stroke="#c9971c" stroke-width="2.6">
    <circle cx="50" cy="58" r="7.5" fill="#fff" fill-opacity=".25"/><circle cx="70" cy="58" r="7.5" fill="#fff" fill-opacity=".25"/>
    <path d="M57.5 58 h5"/><path d="M42.5 57 l-6 -2"/><path d="M77.5 57 l6 -2"/>
  </g>
  <circle cx="50" cy="59" r="2" fill="#3b1846"/><circle cx="70" cy="59" r="2" fill="#3b1846"/>
  <path d="M52 72 q8 6 16 0" stroke="#a0524a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="44" cy="68" r="3" fill="#ff8fa3" opacity=".45"/><circle cx="76" cy="68" r="3" fill="#ff8fa3" opacity=".45"/>
  <g transform="rotate(-18 98 108)">
    <rect x="95" y="112" width="6" height="22" rx="3" fill="#c9971c"/>
    <circle cx="98" cy="102" r="14" fill="#f7c948"/>
    <circle cx="98" cy="102" r="10.5" fill="url(#glass)"/>
    <path d="M92 97 l4 -3" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  </g>
  <ellipse cx="88" cy="118" rx="6" ry="5" fill="#f4c7a1"/>
</svg>`;

// Portrait frame for level n (1..12). Radiance grows with each form.
export function portraitFrame(n, id = 'p') {
  const hue = ['#c9b8c9', '#f5b3c4', '#f7a6a0', '#f7c08a', '#f7d77a', '#cde88a', '#8fdcae', '#7fd3e0', '#8fb8f5', '#b39cf5', '#e29cf0', '#ffd166'][n - 1];
  const rings = Math.ceil(n / 2);
  let out = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="${id}g${n}" cx=".5" cy=".5" r=".5">
      <stop offset=".55" stop-color="${hue}" stop-opacity="${0.15 + n * 0.05}"/><stop offset="1" stop-color="${hue}" stop-opacity="0"/>
    </radialGradient></defs>
    <circle cx="50" cy="50" r="50" fill="url(#${id}g${n})" class="${n > 5 ? 'glow-pulse' : ''}"/>`;
  for (let i = 0; i < rings; i++) {
    out += `<circle cx="50" cy="50" r="${34 + i * 2.6}" fill="none" stroke="${i % 2 ? '#f7c948' : hue}" stroke-width="${i === 0 ? 2.4 : 1.2}" opacity="${1 - i * 0.12}"/>`;
  }
  const rays = n >= 4 ? (n - 3) * 4 : 0;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const r1 = 36 + rings * 2.6, r2 = r1 + 3 + (n / 3);
    out += `<line x1="${50 + Math.cos(a) * r1}" y1="${50 + Math.sin(a) * r1}" x2="${50 + Math.cos(a) * r2}" y2="${50 + Math.sin(a) * r2}" stroke="#ffd166" stroke-width="1" stroke-linecap="round" opacity=".85"/>`;
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const r = 44 + (i % 3);
    out += `<circle class="sparkle" style="animation-delay:${-i * 0.37}s" cx="${50 + Math.cos(a) * r}" cy="${50 + Math.sin(a) * r}" r="${0.8 + (n / 12)}" fill="#fff"/>`;
  }
  if (n === 12) out += `<path d="M50 4 l2 5 5 0 -4 3 1.5 5 -4.5 -3 -4.5 3 1.5 -5 -4 -3 5 0z" fill="#ffd166"/>`;
  return out + '</svg>';
}

// Realm map: the alternatives space as a winding journey through twelve stations.
export function realmMap(levels, current) {
  const pts = [
    [60, 560], [150, 520], [250, 545], [320, 480], [230, 430], [120, 420],
    [70, 350], [170, 300], [280, 320], [330, 240], [220, 180], [130, 110],
  ];
  const path = 'M' + pts.map((p) => p.join(' ')).join(' L ');
  let s = `<svg viewBox="0 0 400 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of the alternatives space">
    <defs>
      <linearGradient id="msk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a1b5e"/><stop offset=".35" stop-color="#c2185b"/><stop offset=".7" stop-color="#f39c4a"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
    </defs>
    <rect width="400" height="620" fill="url(#msk)"/>
    <g fill="none" stroke-width="7" opacity=".4"><path d="M-20 200 A 220 220 0 0 1 420 200" stroke="#ff5a7a"/><path d="M-8 200 A 208 208 0 0 1 408 200" stroke="#ffe066"/><path d="M4 200 A 196 196 0 0 1 396 200" stroke="#6ab7ff"/></g>
    <path d="M0 470 C 90 420 200 470 400 430 L 400 620 L 0 620 Z" fill="#2e9d6a" opacity=".9"/>
    <path d="M0 540 C 120 500 260 560 400 520 L 400 620 L 0 620 Z" fill="#136b43"/>
    <path d="${path}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round" opacity=".85"/>`;
  pts.forEach(([x, y], i) => {
    const l = levels[i];
    const reached = l.n <= current;
    const here = l.n === current;
    s += `<g>
      ${here ? `<circle cx="${x}" cy="${y}" r="22" fill="#ffd166" opacity=".45" class="glow-pulse"/>` : ''}
      <circle cx="${x}" cy="${y}" r="${here ? 14 : 11}" fill="${reached ? '#ffd166' : 'rgba(255,255,255,.35)'}" stroke="${reached ? '#fff' : 'rgba(255,255,255,.6)'}" stroke-width="2.5"/>
      <text x="${x}" y="${y + 4.5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="${reached ? '#3b1846' : '#fff'}">${l.n}</text>
      <text x="${x}" y="${y + ([30,-20,30,-20,30,30,-20,-20,30,-20,30,-20][i])}" text-anchor="middle" font-family="Georgia,serif" font-size="12.5" fill="#fff" opacity="${reached ? 1 : .6}" style="paint-order:stroke" stroke="rgba(59,24,70,.55)" stroke-width="3">${l.name.replace('The ', '')}</text>
    </g>`;
  });
  const [cx, cy] = pts[current - 1];
  s += `<g transform="translate(${cx + 22} ${cy - 46}) scale(.55)">
    <path d="M0 -40 C 26 -40 34 -14 22 6 C 14 19 7 26 5 34 L -5 34 C -7 26 -14 19 -22 6 C -34 -14 -26 -40 0 -40 Z" fill="#ff5a7a"/>
    <path d="M0 -40 C 10 -40 13 -14 8 6 C 5 19 3 26 2 34 L -2 34 C -3 26 -5 19 -8 6 C -13 -14 -10 -40 0 -40 Z" fill="#ffd166"/>
    <rect x="-7" y="44" width="14" height="9" rx="2" fill="#8a5a33"/><path d="M-5 34 L -6 44 M5 34 L 6 44" stroke="#7a4b2a"/></g>`;
  return s + '</svg>';
}
