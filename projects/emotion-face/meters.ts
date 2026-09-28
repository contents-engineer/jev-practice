import { ARKIT_BLENDSHAPES, INTENSITY_LEVELS } from './emotions';

/** Jev's Score answer: the probability of each level, and the expected score as a marker. */
export class IntensityGauge {
  private readonly bars: HTMLElement[];
  private readonly marker: HTMLElement;

  constructor(root: HTMLElement) {
    root.innerHTML =
      INTENSITY_LEVELS.map(
        (level, i) =>
          `<div class="gauge__col"><div class="gauge__track"><i class="gauge__bar"></i></div>` +
          `<span class="gauge__level"><b>${i}</b>${level}</span></div>`,
      ).join('') + '<i class="gauge__marker" hidden></i>';
    this.bars = [...root.querySelectorAll<HTMLElement>('.gauge__bar')];
    this.marker = root.querySelector('.gauge__marker')!;
  }

  set(score: number | null, probabilities?: Record<string, number>) {
    this.bars.forEach((bar, i) => bar.style.setProperty('--p', String(probabilities?.[i] ?? 0)));
    this.marker.hidden = score === null;
    // Level i is centred at (i + 0.5) / 5 of the width.
    if (score !== null) this.marker.style.left = `${((score + 0.5) / INTENSITY_LEVELS.length) * 100}%`;
  }
}

/** The 52 weights actually on the mesh this frame. */
export class ShapeMeter {
  private readonly bars: HTMLElement[];
  private readonly shown = new Float32Array(ARKIT_BLENDSHAPES.length);
  private nextSummary = 0;

  constructor(
    root: HTMLElement,
    private readonly summary: HTMLElement,
  ) {
    root.innerHTML = ARKIT_BLENDSHAPES.map((name) => `<i title="${name}"></i>`).join('');
    this.bars = [...root.querySelectorAll<HTMLElement>('i')];
  }

  update(weights: Float32Array, time: number) {
    for (let i = 0; i < weights.length; i++) {
      if (Math.abs(weights[i] - this.shown[i]) < 0.004) continue;
      this.shown[i] = weights[i];
      this.bars[i].style.setProperty('--w', weights[i].toFixed(3));
      this.bars[i].classList.toggle('is-on', weights[i] > 0.25);
    }
    if (time < this.nextSummary) return;
    this.nextSummary = time + 0.25;
    const top = [...weights.keys()]
      .filter((i) => weights[i] >= 0.05)
      .sort((a, b) => weights[b] - weights[a])
      .slice(0, 3)
      .map((i) => `${ARKIT_BLENDSHAPES[i]} ${weights[i].toFixed(2).replace(/^0/, '')}`);
    this.summary.textContent = top.length ? top.join(' · ') : 'at rest';
  }
}
