// Short original one-liners in the spirit of the teaching. Never quotes. Never guilt.
export const LINES = {
  greet: [
    'The reel is turning. You don’t have to push it.',
    'Good to see you awake in the movie.',
    'Choose lightly today. The world is listening.',
    'No rush. The current already knows the way downhill.',
    'Your frame is waiting. Switch it on whenever it occurs to you.',
    'Look up from the film for a moment. There you are.',
  ],
  unlogged: [
    'A pendulum passed by today. You noticed it. That is enough.',
    'Unrecorded is not undone. The reel kept turning kindly.',
    'Some days are simply lived. Those count too.',
  ],
  morning: [
    'Switch on the frame for an instant, like a light. No effort needed.',
    'Not hoping. Choosing. The will to have, not the desire.',
    'Wake up for a moment: you are in the movie, not watching it.',
  ],
  morningDone: [
    'The frame is on. Turn it on again whenever it naturally comes to mind.',
    'Lovely. Now place one foot in front of the other.',
  ],
  evening: [
    'What did the mirror show you today? Any reflection can be taken as positive.',
    'The mirror answers late. Move the image, not the reflection.',
  ],
  eveningDone: [
    'So it should be. Your world takes care of you.',
    'Whatever turned against the plan — you chose the favourable branch.',
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
    'A goal of your own. Take it calmly, like post from your letter box.',
  ],
  slide: ['Live it, don’t just look at it. Add a detail each time.', 'Your own picture — never borrowed from someone else.'],
  slideRevisit: ['Shyness can be eased with slides. Heavy tension is the heart saying no. Either way, it’s information, not failure.'],
  arrived: ['Life caught up with the slide. Smile — lightly.', 'Arrived, on the mirror’s own schedule.'],
  levelUp: ['You’re a little more awake in the movie. A new chapter has unsealed.', 'Not a victory. A waking. Welcome.'],
  observatory: [
    'These are only the practices you chose to record. Nothing here measures you.',
    'I keep the stars, not the score.',
  ],
  tale: ['Each chapter waits until you’re ready to read it.', 'Stories are reels too.'],
  stepzero: [
    'Don’t think about prestige, realism, or the means. Just: what does your heart long for?',
    'If you have to talk yourself into it, it isn’t yours. That’s good to know.',
    'Don’t be shy. Order whatever you want.',
  ],
};

export function line(kind, seed = Date.now()) {
  const arr = LINES[kind] || LINES.greet;
  return arr[Math.abs(Math.floor(seed)) % arr.length];
}
