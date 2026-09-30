// How much of an expression other people can still read through a pair of sunglasses.
// A staged metaphor built on the emotion-face ARKit presets: it scales blendshape weights by
// what the lens covers. It is NOT a measurement of how people recognise emotions.
import { ARKIT_BLENDSHAPES, EMOTIONS, EMOTION_IDS, type Blendshape, type Mood } from '../emotion-face/emotions';

export type Tone = 'TINT' | 'DARK' | 'MIRROR';
export type Region = 'brow' | 'eye' | 'cheek' | 'lower';

export const REGIONS: readonly Region[] = ['brow', 'eye', 'cheek', 'lower'];
export const REGION_KO: Record<Region, string> = { brow: '눈썹', eye: '눈', cheek: '볼', lower: '입·턱' };

/** Where each blendshape shows on the face. cheekPuff is the lower cheek, so it counts as the mouth area. */
export function regionOf(name: Blendshape): Region {
  if (name.startsWith('brow')) return 'brow';
  if (name.startsWith('eye')) return 'eye';
  if (name.startsWith('cheekSquint')) return 'cheek';
  return 'lower';
}

const REGION_OF = ARKIT_BLENDSHAPES.map(regionOf);

export interface Variant {
  name: string;
  sku: string;
  tone: Tone;
}

/** Front dimensions in mm, as in the product data (lens_width, bridge, frame_front, temple_length, lens_height). */
export interface Frame {
  id: string;
  model: string;
  lensWidth: number;
  bridge: number;
  frameFront: number;
  templeLength: number;
  lensHeight: number;
  variants: readonly Variant[];
}

/**
 * The five models of the first VTO launch and their colour variants, copied from the
 * 2026-09-30 product export. Only sunglasses with a lens type are listed; none of them has CLEAR.
 */
export const FRAMES: readonly Frame[] = [
  {
    id: 'vanilla', model: 'Vanilla', lensWidth: 54.8, bridge: 20, frameFront: 145.4, templeLength: 149.1, lensHeight: 33.4,
    variants: [
      { name: 'Vanilla 01', sku: '0P0M4JBRNF0N6', tone: 'DARK' },
      { name: 'Vanilla GR9', sku: '0P0M4JBSHF0KC', tone: 'TINT' },
      { name: 'Vanilla 01(SM)', sku: '0P0M4JBRSF0KX', tone: 'MIRROR' },
      { name: 'Vanilla R6', sku: '0P0M4JBRXF0KV', tone: 'DARK' },
      { name: 'Vanilla BRC20', sku: '0Q7WZKA0AATF3', tone: 'TINT' },
      { name: 'Vanilla 01 Recycled', sku: 'S11005250', tone: 'DARK' },
    ],
  },
  {
    id: 'rococo', model: 'Rococo', lensWidth: 54.1, bridge: 21, frameFront: 147.2, templeLength: 146.8, lensHeight: 34.6,
    variants: [
      { name: 'Rococo 01', sku: '1BZJQXA73TJ6L', tone: 'DARK' },
      { name: 'Rococo KC6', sku: '1BZJQXA74KLKE', tone: 'TINT' },
      { name: 'Rococo IC1', sku: '1CQWDYRZSE9WI', tone: 'DARK' },
      { name: 'Rococo W2', sku: '1CQWDYRZTAJ8R', tone: 'DARK' },
      { name: 'Rococo OR2', sku: '1CQWDYRZU20ZE', tone: 'DARK' },
      { name: 'Rococo 01 Recycled', sku: 'S11005257', tone: 'DARK' },
    ],
  },
  {
    id: 'boni', model: 'Boni', lensWidth: 55.2, bridge: 21, frameFront: 147.4, templeLength: 147.9, lensHeight: 37.2,
    variants: [
      { name: 'Boni 01', sku: '0P0M4JBQXF0R9', tone: 'DARK' },
      { name: 'Boni T9', sku: '0P0M4JBR5F0HM', tone: 'TINT' },
      { name: 'Boni BRC17', sku: '0P0M4JBRDF0HN', tone: 'MIRROR' },
      { name: 'Boni G11', sku: '0P0M4JBR9F0HR', tone: 'TINT' },
      { name: 'Boni G11(BL)', sku: '0Q7WZK9Q2ATGD', tone: 'TINT' },
      { name: 'Boni T9(G)', sku: '0Q7WZK9QJATBD', tone: 'DARK' },
    ],
  },
  {
    id: 'gent', model: 'Gent', lensWidth: 64.2, bridge: 17, frameFront: 149.1, templeLength: 146.9, lensHeight: 48.3,
    variants: [
      { name: 'Gent 01', sku: '0P0M4JBD5F0JC', tone: 'DARK' },
      { name: 'Gent BRC19', sku: '0P0M4JBDNF0M2', tone: 'TINT' },
      { name: 'Gent BRC21', sku: '0P0M4JBDDF0HT', tone: 'DARK' },
      { name: 'Gent BRC11', sku: '0P0M4JBDXF0NH', tone: 'TINT' },
      { name: 'Gent KC6', sku: '0Q7WZK9TTATFH', tone: 'TINT' },
      { name: 'Gent 01 Recycled', sku: 'S11005249', tone: 'DARK' },
    ],
  },
  {
    id: 'new-her', model: 'New Her', lensWidth: 63.9, bridge: 15, frameFront: 148.9, templeLength: 147, lensHeight: 53.7,
    variants: [
      { name: 'New Her 01', sku: '1F68QMBJNI7MW', tone: 'DARK' },
      { name: 'New Her KC2', sku: '1GOY0PB5CU5EV', tone: 'TINT' },
      { name: 'New Her T1', sku: '9DXMVQHXG2JO', tone: 'DARK' },
      { name: 'New Her 01 Recycled', sku: 'S11005259', tone: 'DARK' },
    ],
  },
];

/**
 * Share of light that reaches the eye area through each lens type, lightest first.
 * Hypotheses: the product data has lens types but no verified transmittance yet.
 */
export const TONES: Record<Tone, { ko: string; transmittance: number }> = {
  TINT: { ko: '틴트', transmittance: 0.5 },
  DARK: { ko: '다크', transmittance: 0.18 },
  MIRROR: { ko: '미러', transmittance: 0.04 },
};
export const TONE_ORDER: readonly Tone[] = ['TINT', 'DARK', 'MIRROR'];

/**
 * Vertical layout in mm from the pupil (+ up). The lens centre sits a little above the pupil;
 * brows move in a band above it and the cheek raise shows below it. Hypotheses to calibrate
 * against photos of people wearing the frames.
 */
export const LAYOUT = {
  lensCentre: 3,
  bands: { brow: [17, 27], eye: [-7, 7], cheek: [-24, -14] } as Record<Exclude<Region, 'lower'>, readonly [number, number]>,
};

/** 0–1: how much of each region's band the lens overlaps. The mouth area is never covered. */
export function coverage(frame: Pick<Frame, 'lensHeight'>): Record<Region, number> {
  const top = LAYOUT.lensCentre + frame.lensHeight / 2;
  const bottom = LAYOUT.lensCentre - frame.lensHeight / 2;
  const overlap = ([lo, hi]: readonly [number, number]) => Math.max(0, Math.min(top, hi) - Math.max(bottom, lo)) / (hi - lo);
  return { brow: overlap(LAYOUT.bands.brow), eye: overlap(LAYOUT.bands.eye), cheek: overlap(LAYOUT.bands.cheek), lower: 0 };
}

/** 0–1 per region: what still shows. A covered region keeps only what the lens lets through. */
export function visibility(frame: Frame | null, tone: Tone | null): Record<Region, number> {
  if (!frame || !tone) return { brow: 1, eye: 1, cheek: 1, lower: 1 };
  const covered = coverage(frame);
  const t = TONES[tone].transmittance;
  return {
    brow: 1 - covered.brow * (1 - t),
    eye: 1 - covered.eye * (1 - t),
    cheek: 1 - covered.cheek * (1 - t),
    lower: 1,
  };
}

/** The blendshape targets a Mood produces, the same sum and clamp Face.setMood uses. */
export function expressionWeights(mood: Mood): number[] {
  const weights = ARKIT_BLENDSHAPES.map(() => 0);
  for (const id of EMOTION_IDS) {
    const amount = mood.mix[id] * mood.strength;
    if (amount === 0) continue;
    for (const [name, weight] of Object.entries(EMOTIONS[id].face) as [Blendshape, number][]) {
      weights[ARKIT_BLENDSHAPES.indexOf(name)] += amount * weight;
    }
  }
  return weights.map((w) => Math.min(1, Math.max(0, w)));
}

export interface Readability {
  /** Share of the expression still visible, 0–1; null when the face shows no expression. */
  total: number | null;
  /** Per region: its share of the whole expression and the part of that share still visible. */
  regions: Record<Region, { share: number; shown: number }>;
}

export function readability(weights: readonly number[], visible: Record<Region, number>): Readability {
  const sums = { brow: 0, eye: 0, cheek: 0, lower: 0 };
  weights.forEach((w, i) => (sums[REGION_OF[i]] += w));
  const all = sums.brow + sums.eye + sums.cheek + sums.lower;
  const regions = Object.fromEntries(
    REGIONS.map((r) => [r, { share: all ? sums[r] / all : 0, shown: all ? (sums[r] * visible[r]) / all : 0 }]),
  ) as Readability['regions'];
  if (all < 1e-6) return { total: null, regions };
  return { total: REGIONS.reduce((sum, r) => sum + regions[r].shown, 0), regions };
}

export interface LensOption {
  frame: Frame;
  tone: Tone;
  /** The first variant of this frame in this lens type, shown as the example product. */
  variant: Variant;
}

/** One option per frame and lens type that the product data actually has. */
export const OPTIONS: readonly LensOption[] = FRAMES.flatMap((frame) =>
  TONE_ORDER.flatMap((tone) => {
    const variant = frame.variants.find((v) => v.tone === tone);
    return variant ? [{ frame, tone, variant }] : [];
  }),
);

/** The options whose readability lands closest to how much the person wants to show (0–1). */
export function recommend(weights: readonly number[], wanted: number, count = 3): (LensOption & { total: number })[] {
  const scored = OPTIONS.map((option) => ({
    ...option,
    total: readability(weights, visibility(option.frame, option.tone)).total,
  })).filter((o): o is LensOption & { total: number } => o.total !== null);
  return scored.sort((a, b) => Math.abs(a.total - wanted) - Math.abs(b.total - wanted)).slice(0, count);
}
