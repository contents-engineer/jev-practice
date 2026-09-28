// The suspect's face: composure tiers and turn events become Moods for the Face Cap head
// shared with the emotion-face page. Artistic choices, not measurements.
import { NEUTRAL, type EmotionId, type Mood } from '../emotion-face/emotions';
import type { Tier } from './cases';
import type { EventKind } from './engine';

function mood(mix: Partial<Record<EmotionId, number>>, strength: number): Mood {
  return { mix: { ...NEUTRAL.mix, ...mix }, strength };
}

/** The resting expression for each composure tier. */
export const TIER_MOOD: Record<Tier, Mood> = {
  calm: mood({ neutral: 1 }, 0),
  open: mood({ happy: 0.6, sad: 0.4 }, 0.22),
  nervous: mood({ fear: 0.6, surprised: 0.15, sad: 0.25 }, 0.42),
  defensive: mood({ angry: 0.65, contempt: 0.35 }, 0.55),
  shaken: mood({ fear: 0.55, sad: 0.45 }, 0.7),
  broken: mood({ sad: 0.85, fear: 0.15 }, 0.85),
};

export function moodForTier(tier: Tier): Mood {
  return TIER_MOOD[tier];
}

const FLASHES: Partial<Record<EventKind, { mood: Mood; ms: number }>> = {
  crack: { mood: mood({ surprised: 0.7, fear: 0.3 }, 0.9), ms: 1800 },
  bluff_worked: { mood: mood({ surprised: 0.5, fear: 0.5 }, 0.8), ms: 1500 },
  bluff_called: { mood: mood({ contempt: 0.8, angry: 0.2 }, 0.7), ms: 1500 },
  coerced: { mood: mood({ fear: 0.6, angry: 0.4 }, 0.8), ms: 1500 },
  adapt: { mood: mood({ surprised: 0.45, fear: 0.3, neutral: 0.25 }, 0.5), ms: 1200 },
  deflect: { mood: mood({ contempt: 0.6, happy: 0.2, neutral: 0.2 }, 0.35), ms: 1200 },
  false_promise: { mood: mood({ happy: 0.5, surprised: 0.3, fear: 0.2 }, 0.4), ms: 1200 },
};

/** A short expression that plays before the face settles into its tier, if the turn earned one. */
export function flashForEvents(events: readonly EventKind[]): { mood: Mood; ms: number } | null {
  for (const event of ['crack', 'bluff_worked', 'bluff_called', 'coerced', 'adapt', 'deflect', 'false_promise'] as const) {
    if (events.includes(event)) return FLASHES[event] ?? null;
  }
  return null;
}
