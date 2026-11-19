// Short original one-liners in the spirit of the teaching. Never quotes. Never guilt.
export const LINES = {
  greet: [
    'The reel is turning. You don’t have to push it.',
    'Good to see you awake in the movie.',
    'Choose lightly today. The world is listening.',
    'No rush. The current already knows the way downhill.',
    'Your frame is waiting. It’s patient.',
    'Look up from the film for a moment. There you are.',
  ],
  unlogged: [
    'A pendulum passed by today. You noticed it. That is enough.',
    'Unrecorded is not undone. The reel kept turning kindly.',
    'Some days are simply lived. Those count too.',
  ],
  morning: [
    'Declare it, then let it go. A lit frame stays lit.',
    'Not hoping. Choosing.',
    'Hold the scene the way you’d hold a warm cup — easily.',
  ],
  morningDone: [
    'The frame is lit. Go and enjoy the day it shapes.',
    'Lovely. Now forget about it, and let the world do its part.',
  ],
  evening: [
    'What did the mirror show you today? No judging. Just looking.',
    'The mirror answers late. Notice, don’t demand.',
  ],
  eveningDone: [
    'So it should be. Your world takes care of you.',
    'Rest now. The reel turns even while you sleep.',
  ],
  questAccept: ['An invitation, not a debt. Enjoy it.', 'Take it lightly — like a stroll, not a march.'],
  questDecline: ['Of course. Not every door is yours this week.', 'Declining is choosing too.'],
  questDone: ['Lived, not ticked. Well walked.', 'The step itself was the point. Lovely.'],
  questLetGo: ['Set down without a trace. No debt here.'],
  release: [
    'Letting go is a healthy move. The scales breathe easier now.',
    'Released with a light hand. Nothing is lost — only weight.',
    'If it was yours, it can return. If not, you’ve made room.',
  ],
  goalAdmitted: [
    'That one feels like your own handwriting.',
    'A goal of your own. Hold it like a trip to buy a newspaper.',
  ],
  slide: ['From inside your own eyes — that’s the way.', 'A frame worth humming now and then.'],
  slideRevisit: ['Discomfort is information, not failure. Let’s look again.'],
  arrived: ['Life caught up with the slide. Smile — lightly.', 'Arrived, on the mirror’s own schedule.'],
  levelUp: ['You’re a little more awake in the movie. A new chapter has unsealed.', 'Not a victory. A waking. Welcome.'],
  observatory: [
    'These are only the practices you chose to record. Nothing here measures you.',
    'I keep the stars, not the score.',
  ],
  tale: ['Each chapter waits until you’re ready to read it.', 'Stories are reels too.'],
  stepzero: [
    'Only goals that feel like home get through the gate.',
    'If you have to talk yourself into it, it isn’t yours. That’s good to know.',
  ],
};

export function line(kind, seed = Date.now()) {
  const arr = LINES[kind] || LINES.greet;
  return arr[Math.abs(Math.floor(seed)) % arr.length];
}
