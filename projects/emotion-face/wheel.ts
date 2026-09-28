import { EMOTION_IDS, EMOTIONS, type EmotionId } from './emotions';

const NS = 'http://www.w3.org/2000/svg';
/** Petal length at probability 1. */
const R = 92;
const PETAL = `M14 0 C32 -24 62 -32 ${R} 0 C62 32 32 24 14 0 Z`;

/**
 * Plutchik's wheel as a live chart of Jev's Choice answer: each petal's area
 * is the probability Jev gives that emotion.
 */
export class Wheel {
  private readonly groups: SVGGElement[] = [];
  private readonly petals: SVGPathElement[] = [];
  private readonly percents: SVGTSpanElement[] = [];
  private readonly target = new Float32Array(EMOTION_IDS.length);
  private readonly eased = new Float32Array(EMOTION_IDS.length);

  constructor(svg: SVGSVGElement) {
    const add = <K extends keyof SVGElementTagNameMap>(
      parent: Element,
      tag: K,
      attrs: Record<string, string | number>,
    ): SVGElementTagNameMap[K] => {
      const node = document.createElementNS(NS, tag);
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
      parent.append(node);
      return node;
    };

    add(svg, 'circle', { r: R / 2, class: 'wheel__ring' }); // a petal reaching this ring means 25%
    add(svg, 'circle', { r: R, class: 'wheel__ring' });
    EMOTION_IDS.forEach((id, i) => {
      const angle = -90 + i * 45;
      const group = add(svg, 'g', { class: 'wheel__emotion', style: `--c: ${EMOTIONS[id].color}` });
      const petals = add(group, 'g', { transform: `rotate(${angle})` });
      add(petals, 'path', { d: PETAL, class: 'wheel__guide' });
      this.petals.push(add(petals, 'path', { d: PETAL, class: 'wheel__petal', transform: 'scale(0)' }));

      const rad = (angle * Math.PI) / 180;
      const [cos, sin] = [Math.cos(rad), Math.sin(rad)];
      const x = cos * (R + 12);
      const y = sin * (R + 12) + (sin < -0.5 ? -12 : sin > 0.5 ? 9 : -3);
      const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
      const label = add(group, 'text', { x, y, 'text-anchor': anchor, class: 'wheel__label' });
      add(label, 'tspan', { x, class: 'wheel__name' }).textContent = EMOTIONS[id].label;
      this.percents.push(add(label, 'tspan', { x, dy: 12, class: 'wheel__pct' }));
      this.groups.push(group);
    });
    add(svg, 'circle', { r: 3, class: 'wheel__hub' });
  }

  set(probabilities: Record<EmotionId, number> | null, choice: EmotionId | null) {
    EMOTION_IDS.forEach((id, i) => {
      const p = probabilities?.[id] ?? 0;
      this.target[i] = Math.sqrt(p);
      this.percents[i].textContent = probabilities ? `${Math.round(p * 100)}%` : '';
      this.groups[i].classList.toggle('is-choice', id === choice);
    });
  }

  update(dt: number) {
    const k = 1 - Math.exp(-8 * dt);
    for (let i = 0; i < this.petals.length; i++) {
      const delta = this.target[i] - this.eased[i];
      if (Math.abs(delta) < 1e-4) continue;
      this.eased[i] += delta * k;
      this.petals[i].setAttribute('transform', `scale(${this.eased[i].toFixed(4)})`);
    }
  }
}
