// Book I — twelve forms of waking up inside the movie.
// XP measures practice only. It never measures progress toward a goal, or worth.
export const LEVELS = [
  { n: 1,  name: 'The Sleeper',            xp: 0 },
  { n: 2,  name: 'The Awakening',          xp: 100 },
  { n: 3,  name: 'The Observer',           xp: 200 },
  { n: 4,  name: 'The Weaver',             xp: 600 },
  { n: 5,  name: 'The Creator',            xp: 1200 },
  { n: 6,  name: 'The Transurfer',         xp: 2000 },
  { n: 7,  name: 'The Framekeeper',        xp: 3000 },
  { n: 8,  name: 'The Plait Bearer',       xp: 4200 },
  { n: 9,  name: 'The Mirrorwalker',       xp: 5800 },
  { n: 10, name: 'The Lifeline Shifter',   xp: 7800 },
  { n: 11, name: 'The Star Composer',      xp: 10200 },
  { n: 12, name: 'The Priestess of the Reel', xp: 13000 },
];

export function levelFor(xp) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xp) cur = l;
  const next = LEVELS.find((l) => l.xp > xp) || null;
  return { ...cur, next: next ? { n: next.n, name: next.name, xp: next.xp } : null };
}

// Practice payouts. Small, steady, and never tied to outcomes.
export const XP = {
  goalAdmitted: 10,   // completing Step Zero for a goal is practice in itself
  morningFrame: 10,
  eveningMirror: 10,
  slideComposed: 5,
  slideArrived: 15,
  trial: 30,
};
