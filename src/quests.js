// Weekly invitations. Always acceptable, declinable, abandonable. They dissolve when the week turns.
// {goal} is replaced with the short name of one of your chosen goals.
export const QUEST_POOL = [
  { id: 'slide-three', xp: 20, title: 'Hold the slide, lightly',
    text: 'On any three days this week, spend one quiet minute inside the end scene of {goal}. Feel it as ordinary, then let it go.' },
  { id: 'process-slide', xp: 15, title: 'Enjoy one step of the path',
    text: 'Do one small thing on the road toward {goal} purely for the pleasure of doing it. Notice how the step itself feels.' },
  { id: 'pendulum-spot', xp: 15, title: 'Notice a pendulum',
    text: 'Catch one moment this week when something tugs at your attention with worry, outrage, or comparison. Name it to yourself and step aside. No fight required.' },
  { id: 'importance-lower', xp: 20, title: 'Set the weight down',
    text: 'When {goal} starts to feel heavy or urgent, treat it like a trip to buy a newspaper for a moment. Write one line on how that shifts things.' },
  { id: 'freiling', xp: 20, area: 'relationships', title: 'Freiling: give first',
    text: 'Give someone the very thing you hope to receive: attention, warmth, ease, or respect. Expect nothing back.' },
  { id: 'coordination', xp: 15, title: 'My world takes care of me',
    text: 'When something goes "wrong" this week, say: "So it should be. My world takes care of me." Note what the turn opened up.' },
  { id: 'unity', xp: 20, title: 'Ask the soul',
    text: 'Before one decision this week, pause and notice the soul\'s answer — the quiet sense of comfort or discomfort — before the mind argues.' },
  { id: 'presence-walk', xp: 15, title: 'Wake up in the movie',
    text: 'Take one walk or ordinary task fully awake: "I see myself, and I see reality." Return each time you drift.' },
  { id: 'mirror-smile', xp: 15, title: 'Smile at the mirror first',
    text: 'The world reflects your attitude back with a delay. Choose one day to meet it with warmth first, and simply watch.' },
  { id: 'wave-ride', xp: 15, title: 'Ride a wave of fortune',
    text: 'When a small good thing happens, stay with it a moment longer. Let one good wave carry you to the next instead of rushing past.' },
  { id: 'outer-intention', xp: 20, title: 'Leave the "how" to the world',
    text: 'Notice where you are scripting the route to {goal}. Release the script and keep only the end frame. Write what that frees up.' },
  { id: 'gratitude-door', xp: 15, title: 'Find your door',
    text: 'List three things you already enjoy that touch {goal}, even slightly. Doors often open from what already feels like yours.' },
  { id: 'plait', xp: 20, title: 'Feel the plait',
    text: 'On two mornings, turn your attention to the space behind your shoulder blades, hold the frame of {goal} for a breath, and let it go.' },
  { id: 'balance', xp: 15, title: 'Let the scales rest',
    text: 'Notice one place you are over-valuing something — yourself, someone else, or an outcome. Soften it a little and watch the balance settle.' },
  { id: 'comfort-zone', xp: 20, title: 'Widen the comfort zone',
    text: 'Picture yourself already living {goal} in an everyday moment until it feels like home rather than a stretch.' },
  { id: 'unrecorded-ok', xp: 10, title: 'Do one thing without a goal',
    text: 'Spend some time this week doing something for no reason at all. Not everything has to lead somewhere.' },
  { id: 'give-home', xp: 15, area: 'home', title: 'Tend the home you have',
    text: 'Give your current space one small act of care, as if it were already the home of {goal}.' },
  { id: 'body-kind', xp: 15, area: 'body', title: 'Move for joy',
    text: 'Choose one kind of movement this week only because it feels good. Let the body vote.' },
  { id: 'work-play', xp: 15, area: 'work', title: 'Work as the scene',
    text: 'Do one piece of work the way the version of you in {goal} would do it: unhurried and absorbed.' },
];

// Deterministic pick so the same week always offers the same invitations.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function pickQuests(week, goals, count = 4) {
  const active = goals.filter((g) => g.status === 'active');
  const pool = QUEST_POOL.filter((q) => {
    if (q.text.includes('{goal}') && !active.length) return false;
    if (q.area && !active.some((g) => g.area === q.area)) return false;
    return true;
  });
  const ranked = pool
    .map((q) => ({ q, k: hash(week + ':' + q.id) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, count);
  return ranked.map(({ q }, i) => {
    let goal = null;
    if (q.text.includes('{goal}')) {
      const fitting = q.area ? active.filter((g) => g.area === q.area) : active;
      goal = fitting[(hash(week + q.id) + i) % fitting.length];
    }
    return {
      template: q.id,
      title: q.title,
      text: q.text.replaceAll('{goal}', goal ? `“${goal.title}”` : 'your goal'),
      goal_id: goal ? goal.id : null,
      xp: q.xp,
    };
  });
}
