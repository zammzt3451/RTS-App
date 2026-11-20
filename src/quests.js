// Weekly invitations. Always acceptable, declinable, abandonable. They dissolve when the week turns.
// {goal} is replaced with the short name of one of your chosen goals.
export const QUEST_POOL = [
  { id: 'slide-three', xp: 20, title: 'Turn the slide',
    text: 'On any three days this week, live inside the target slide of {goal} for a few minutes, as if it is already yours. Add one new detail each time.' },
  { id: 'process-slide', xp: 15, title: 'Visualise the current link',
    text: 'Pick the step you are on right now toward {goal}. Picture it taking shape and growing well, the way a seed becomes a plant. Then take that step willingly.' },
  { id: 'pendulum-spot', xp: 15, title: 'Notice a pendulum',
    text: 'Catch one moment this week when something tugs at you with worry, outrage, or comparison. Don\'t avoid it or fight it — simply ignore it, or break its script by answering in an unexpected way.' },
  { id: 'importance-lower', xp: 20, title: 'Set the weight down',
    text: 'When {goal} feels heavy or urgent, accept that it might not work out, then take your next step anyway — calmly, the way you take post from your letter box. Write one line on how that shifts things.' },
  { id: 'frailing', xp: 20, title: 'Frailing: give first',
    text: 'Let go of the intention to get and replace it with the intention to give. Show sincere interest in someone and lift their sense of self-worth. Expect nothing back.' },
  { id: 'coordination', xp: 15, title: 'Coordinate intention',
    text: 'When something goes against the plan this week, choose to see it as positive: "So it should be." Note what the turn opened up.' },
  { id: 'amalgam', xp: 15, title: 'Mix your amalgam',
    text: 'Each time something good happens, even something tiny, notice it and say: "My world takes care of me." Watch how the mirror responds.' },
  { id: 'unity', xp: 20, title: 'Ask the soul',
    text: 'Before one decision this week, pause and notice the soul\'s answer — the quiet sense of comfort or discomfort — before the mind argues.' },
  { id: 'presence-walk', xp: 15, title: 'Wake up in the movie',
    text: 'Take one walk or ordinary task fully awake: "I see myself, and I see reality." Return each time you drift.' },
  { id: 'mirror-smile', xp: 15, title: 'Smile at the mirror first',
    text: 'The world reflects your relationship to it, with a delay. Choose one day to think only about what you want — not what you don\'t — and meet the world warmly first.' },
  { id: 'wave-ride', xp: 15, title: 'Ride a wave of fortune',
    text: 'When a small good thing happens, stay with it a moment longer. Let one good wave carry you to the next instead of rushing past.' },
  { id: 'outer-intention', xp: 20, title: 'Leave the "how" to the world',
    text: 'Notice where you are scripting the route to {goal}. Release the script and keep only the end frame. Write what that frees up.' },
  { id: 'gratitude-door', xp: 15, title: 'Notice your door',
    text: 'List three things you do willingly and easily that feel inspiring. Your door shows itself through inspiration — no need to force it.' },
  { id: 'frame', xp: 20, title: 'Switch on the frame',
    text: 'Whenever it naturally occurs to you this week, switch on the frame of {goal} for an instant — a flash image and its feeling — like turning on a light.' },
  { id: 'balance', xp: 15, title: 'Let the scales rest',
    text: 'Notice one place you are attaching too much importance — to yourself, someone else, or an outcome. Let go of the need to judge or prove, and watch the balance settle.' },
  { id: 'comfort-zone', xp: 20, title: 'Widen the comfort zone',
    text: 'Picture yourself already living {goal} in an everyday moment until "Can this really be for me?" turns into "Of course it is." You deserve the best.' },
  { id: 'wave-joy', xp: 10, title: 'Take joy in a setback',
    text: 'Adopt the "foolish habit" for a day: greet every small setback with a smile, and stay on the favourable branch.' },
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
      const main = fitting.find((g) => g.is_main);
      goal = main && i % 2 === 0 ? main : fitting[(hash(week + q.id) + i) % fitting.length];
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
