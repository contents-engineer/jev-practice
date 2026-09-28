/** One labelled row: its key in Jev's `probabilities`, a label and optionally its own colour. */
export interface BarRow {
  key: string;
  label: string;
  /** Rows without a colour use the list's `--c`. */
  color?: string;
}

/** A `probabilities` map from Jev's answer as labelled bars with values, the top row emphasised. */
export class ProbabilityBars {
  private readonly rows: { key: string; item: HTMLElement; value: HTMLElement }[];

  constructor(list: HTMLElement, rows: readonly BarRow[]) {
    this.rows = rows.map(({ key, label, color }) => {
      const item = document.createElement('li');
      if (color) item.style.setProperty('--c', color);
      const name = document.createElement('span');
      name.className = 'bars__name';
      name.textContent = label;
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.append(document.createElement('i'));
      const value = document.createElement('span');
      value.className = 'bars__value';
      item.append(name, bar, value);
      list.append(item);
      return { key, item, value };
    });
    this.set(null, null);
  }

  /** `null` means no reading yet: empty bars and dashes instead of zeros. */
  set(values: Record<string, number> | null, top: string | null) {
    for (const { key, item, value } of this.rows) {
      const v = values?.[key] ?? 0;
      item.style.setProperty('--v', String(v));
      item.classList.toggle('is-top', key === top);
      value.textContent = values ? v.toFixed(3) : '–';
    }
  }
}
