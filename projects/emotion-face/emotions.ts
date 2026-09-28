import type { EmotionId } from './server';

export type { EmotionId };

/** The 52 ARKit blendshapes, in the order Face Cap stores them. */
export const ARKIT_BLENDSHAPES = [
  'browInnerUp', 'browDown_L', 'browDown_R', 'browOuterUp_L', 'browOuterUp_R',
  'eyeLookUp_L', 'eyeLookUp_R', 'eyeLookDown_L', 'eyeLookDown_R', 'eyeLookIn_L', 'eyeLookIn_R',
  'eyeLookOut_L', 'eyeLookOut_R', 'eyeBlink_L', 'eyeBlink_R', 'eyeSquint_L', 'eyeSquint_R',
  'eyeWide_L', 'eyeWide_R', 'cheekPuff', 'cheekSquint_L', 'cheekSquint_R', 'noseSneer_L', 'noseSneer_R',
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthRollUpper', 'mouthRollLower', 'mouthShrugUpper', 'mouthShrugLower', 'mouthClose',
  'mouthSmile_L', 'mouthSmile_R', 'mouthFrown_L', 'mouthFrown_R', 'mouthDimple_L', 'mouthDimple_R',
  'mouthUpperUp_L', 'mouthUpperUp_R', 'mouthLowerDown_L', 'mouthLowerDown_R', 'mouthPress_L', 'mouthPress_R',
  'mouthStretch_L', 'mouthStretch_R', 'tongueOut',
] as const;

export type Blendshape = (typeof ARKIT_BLENDSHAPES)[number];
type Shapes = Partial<Record<Blendshape, number>>;
type Pair = Blendshape extends infer B ? (B extends `${infer P}_L` ? P : never) : never;

/** The same weight on both sides of a left/right pair. */
const both = (name: Pair, v: number): Shapes => ({ [`${name}_L`]: v, [`${name}_R`]: v });

export interface Emotion {
  label: string;
  /** Hue from Plutchik's wheel, lifted a little for a dark stage. */
  color: string;
  /** Plutchik's names for the mild, basic and intense form. */
  words: readonly [string, string, string];
  /** ARKit weights at full intensity, after the FACS action units for the emotion. */
  face: Shapes;
  /** Head pitch (+ nods down), yaw and roll in radians. */
  head: readonly [number, number, number];
  /** Eye pitch (+ looks down) and yaw in radians. */
  gaze: readonly [number, number];
}

export const EMOTIONS: Record<EmotionId, Emotion> = {
  joy: {
    label: 'Joy',
    color: '#f5cf3d',
    words: ['serenity', 'joy', 'ecstasy'],
    // AU6 cheek raiser + AU12 lip corner puller, lips parted
    face: {
      ...both('mouthSmile', 0.9), ...both('cheekSquint', 0.8), ...both('eyeSquint', 0.6),
      ...both('mouthDimple', 0.3), ...both('mouthUpperUp', 0.22), ...both('mouthLowerDown', 0.2),
      browInnerUp: 0.1, jawOpen: 0.14,
    },
    head: [-0.05, 0, 0.04],
    gaze: [0, 0],
  },
  trust: {
    label: 'Trust',
    color: '#9ad35c',
    words: ['acceptance', 'trust', 'admiration'],
    // a soft closed smile, relaxed lids, head tilted
    face: {
      ...both('mouthSmile', 0.55), ...both('cheekSquint', 0.4), ...both('eyeSquint', 0.35),
      ...both('eyeBlink', 0.22), ...both('mouthDimple', 0.3), ...both('mouthPress', 0.15), browInnerUp: 0.35,
    },
    head: [0.04, 0, 0.14],
    gaze: [0.02, 0],
  },
  fear: {
    label: 'Fear',
    color: '#34b27a',
    words: ['apprehension', 'fear', 'terror'],
    // AU1+2+4 brows up and drawn together, AU5 upper lid raiser, AU20 lip stretcher, AU26 jaw drop
    face: {
      browInnerUp: 0.95, ...both('browOuterUp', 0.5), ...both('browDown', 0.25), ...both('eyeWide', 0.9),
      ...both('mouthStretch', 0.65), ...both('mouthLowerDown', 0.18), ...both('mouthFrown', 0.2), jawOpen: 0.12,
    },
    head: [-0.07, 0.08, 0],
    gaze: [0, -0.07],
  },
  surprise: {
    label: 'Surprise',
    color: '#3cb6dc',
    words: ['distraction', 'surprise', 'amazement'],
    // AU1+2 brows up, AU5 eyes wide, AU26 jaw drop
    face: {
      browInnerUp: 0.9, ...both('browOuterUp', 0.95), ...both('eyeWide', 0.95),
      jawOpen: 0.4, mouthFunnel: 0.25, ...both('mouthLowerDown', 0.08),
    },
    head: [-0.09, 0, 0],
    gaze: [0, 0],
  },
  sadness: {
    label: 'Sadness',
    color: '#5584ec',
    words: ['pensiveness', 'sadness', 'grief'],
    // AU1+4 inner brows up, AU15 lip corner depressor, AU17 chin raiser, heavy lids
    face: {
      browInnerUp: 0.85, ...both('browDown', 0.3), ...both('mouthFrown', 0.75), mouthShrugLower: 0.45,
      ...both('mouthPress', 0.2), mouthRollLower: 0.12, ...both('eyeBlink', 0.22), ...both('eyeSquint', 0.15),
    },
    head: [0.16, 0, -0.04],
    gaze: [0.18, 0],
  },
  disgust: {
    label: 'Disgust',
    color: '#ab6fdb',
    words: ['boredom', 'disgust', 'loathing'],
    // AU9 nose wrinkler, AU10 upper lip raiser, AU15+16, lowered brows
    face: {
      ...both('noseSneer', 1), mouthUpperUp_L: 0.8, mouthUpperUp_R: 0.55, ...both('mouthFrown', 0.45),
      ...both('mouthLowerDown', 0.2), ...both('browDown', 0.7), ...both('eyeSquint', 0.6),
      ...both('cheekSquint', 0.55), mouthShrugUpper: 0.35, mouthLeft: 0.2,
    },
    head: [-0.05, -0.12, 0.05],
    gaze: [0.05, 0.1],
  },
  anger: {
    label: 'Anger',
    color: '#ef5143',
    words: ['annoyance', 'anger', 'rage'],
    // AU4 brow lowerer, AU5+7 glaring lids, AU23+24 pressed lips, AU17 chin raiser
    face: {
      ...both('browDown', 1), ...both('eyeSquint', 0.5), ...both('eyeWide', 0.3), ...both('noseSneer', 0.6),
      ...both('mouthPress', 0.7), mouthRollLower: 0.3, mouthRollUpper: 0.2, ...both('mouthFrown', 0.45),
      mouthShrugLower: 0.4, jawForward: 0.2,
    },
    head: [0.08, 0, 0],
    gaze: [-0.03, 0],
  },
  anticipation: {
    label: 'Anticipation',
    color: '#f59b3c',
    words: ['interest', 'anticipation', 'vigilance'],
    // one brow up, eyes open, a lip-biting half smile
    face: {
      browInnerUp: 0.4, browOuterUp_L: 0.75, browOuterUp_R: 0.3, ...both('eyeWide', 0.35),
      mouthSmile_L: 0.25, mouthSmile_R: 0.5, mouthRollLower: 0.4, ...both('mouthPress', 0.1), jawOpen: 0.04,
    },
    head: [0.05, 0.06, -0.1],
    gaze: [-0.07, 0.03],
  },
};

/** Clockwise from the top, as on Plutchik's wheel: opposites sit across from each other. */
export const EMOTION_IDS: readonly EmotionId[] = [
  'joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation',
];

export const INTENSITY_LEVELS = ['barely', 'mild', 'moderate', 'strong', 'overwhelming'] as const;

/** How much of each emotion the face shows, and how strongly overall. */
export interface Mood {
  mix: Record<EmotionId, number>;
  strength: number;
}

export const NEUTRAL: Mood = {
  mix: Object.fromEntries(EMOTION_IDS.map((id) => [id, 0])) as Record<EmotionId, number>,
  strength: 0,
};

export function moodOf(probabilities: Record<EmotionId, number>, score: number): Mood {
  // Squaring lets the leading emotion dominate while close calls still blend.
  let total = 0;
  for (const id of EMOTION_IDS) total += probabilities[id] ** 2;
  const mix = { ...NEUTRAL.mix };
  if (total > 0) for (const id of EMOTION_IDS) mix[id] = probabilities[id] ** 2 / total;
  // Score is 0–4; the curve keeps moderate feelings readable on the face.
  return { mix, strength: Math.min(1, Math.max(0, score / 4)) ** 0.6 };
}

/** Plutchik's word for this emotion at the given score (0–4). */
export function plutchikWord(id: EmotionId, score: number) {
  const [mild, base, intense] = EMOTIONS[id].words;
  return score < 1.35 ? mild : score < 2.75 ? base : intense;
}
