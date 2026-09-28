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
  /** Korean name shown next to the English label. */
  ko: string;
  color: string;
  /** ARKit weights at full intensity, after the FACS action units for the expression. */
  face: Shapes;
  /** Head pitch (+ nods down), yaw and roll in radians. */
  head: readonly [number, number, number];
  /** Eye pitch (+ looks down) and yaw in radians. */
  gaze: readonly [number, number];
}

export const EMOTIONS: Record<EmotionId, Emotion> = {
  neutral: {
    ko: '중립',
    color: '#9ca3af',
    // the face at rest: a neutral reading only dilutes whatever else Jev saw
    face: {},
    head: [0, 0, 0],
    gaze: [0, 0],
  },
  happy: {
    ko: '기쁨',
    color: '#e9c24a',
    // AU6 cheek raiser + AU12 lip corner puller, lips parted
    face: {
      ...both('mouthSmile', 0.9), ...both('cheekSquint', 0.8), ...both('eyeSquint', 0.6),
      ...both('mouthDimple', 0.3), ...both('mouthUpperUp', 0.22), ...both('mouthLowerDown', 0.2),
      browInnerUp: 0.1, jawOpen: 0.14,
    },
    head: [-0.05, 0, 0.04],
    gaze: [0, 0],
  },
  sad: {
    ko: '슬픔',
    color: '#4f7fdc',
    // AU1+4 inner brows up, AU15 lip corner depressor, AU17 chin raiser, heavy lids
    face: {
      browInnerUp: 0.85, ...both('browDown', 0.3), ...both('mouthFrown', 0.75), mouthShrugLower: 0.45,
      ...both('mouthPress', 0.2), mouthRollLower: 0.12, ...both('eyeBlink', 0.22), ...both('eyeSquint', 0.15),
    },
    head: [0.16, 0, -0.04],
    gaze: [0.18, 0],
  },
  angry: {
    ko: '분노',
    color: '#e2554b',
    // AU4 brow lowerer, AU5+7 glaring lids, AU23+24 pressed lips, AU17 chin raiser
    face: {
      ...both('browDown', 1), ...both('eyeSquint', 0.5), ...both('eyeWide', 0.3), ...both('noseSneer', 0.6),
      ...both('mouthPress', 0.7), mouthRollLower: 0.3, mouthRollUpper: 0.2, ...both('mouthFrown', 0.45),
      mouthShrugLower: 0.4, jawForward: 0.2,
    },
    head: [0.08, 0, 0],
    gaze: [-0.03, 0],
  },
  surprised: {
    ko: '놀람',
    color: '#f08c3b',
    // AU1+2 brows up, AU5 eyes wide, AU26 jaw drop
    face: {
      browInnerUp: 0.9, ...both('browOuterUp', 0.95), ...both('eyeWide', 0.95),
      jawOpen: 0.4, mouthFunnel: 0.25, ...both('mouthLowerDown', 0.08),
    },
    head: [-0.09, 0, 0],
    gaze: [0, 0],
  },
  fear: {
    ko: '두려움',
    color: '#7d5ee0',
    // AU1+2+4 brows up and drawn together, AU5 upper lid raiser, AU20 lip stretcher, AU26 jaw drop
    face: {
      browInnerUp: 0.95, ...both('browOuterUp', 0.5), ...both('browDown', 0.25), ...both('eyeWide', 0.9),
      ...both('mouthStretch', 0.65), ...both('mouthLowerDown', 0.18), ...both('mouthFrown', 0.2), jawOpen: 0.12,
    },
    head: [-0.07, 0.08, 0],
    gaze: [0, -0.07],
  },
  disgust: {
    ko: '혐오',
    color: '#8ea83e',
    // AU9 nose wrinkler, AU10 upper lip raiser, AU15+16, lowered brows
    face: {
      ...both('noseSneer', 1), mouthUpperUp_L: 0.8, mouthUpperUp_R: 0.55, ...both('mouthFrown', 0.45),
      ...both('mouthLowerDown', 0.2), ...both('browDown', 0.7), ...both('eyeSquint', 0.6),
      ...both('cheekSquint', 0.55), mouthShrugUpper: 0.35, mouthLeft: 0.2,
    },
    head: [-0.05, -0.12, 0.05],
    gaze: [0.05, 0.1],
  },
  contempt: {
    ko: '경멸',
    color: '#36a99b',
    // AU12+14 on one side only: a tightened half smirk, chin up, looking down the nose
    face: {
      mouthDimple_R: 0.7, mouthSmile_R: 0.35, mouthPress_R: 0.25, mouthRight: 0.18, ...both('eyeSquint', 0.25),
      browDown_L: 0.2, browOuterUp_R: 0.15, noseSneer_R: 0.15,
    },
    head: [-0.07, 0.07, -0.05],
    gaze: [0.07, -0.04],
  },
};

/** Display order, as in the original demo's readout. */
export const EMOTION_IDS: readonly EmotionId[] = [
  'neutral', 'happy', 'sad', 'angry', 'surprised', 'fear', 'disgust', 'contempt',
];

/** Names for Jev's intensity levels 0–4. */
export const INTENSITY_LEVELS = ['거의 없음', '약함', '분명함', '강함', '압도적'] as const;

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
