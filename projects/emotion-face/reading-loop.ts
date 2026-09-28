/** A single in-flight request with a latest-value queue. Only current revisions render. */
export class ReadingLoop<T> {
  private text = '';
  private revision = 0;
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queued = false;
  private changedAt = 0;

  constructor(private readonly callbacks: {
    read: (text: string) => Promise<T>;
    show: (value: T, text: string, elapsed: number) => void;
    pending: () => void;
    idle: () => void;
    error: (error: unknown) => void;
  }, private readonly delay = 90) {}

  update(value: string) {
    const text = value.trim();
    if (text === this.text) return;
    this.revision++;
    this.text = text;
    this.changedAt = performance.now();
    this.queued = true;
    if (!text) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.callbacks.idle();
      return;
    }
    this.callbacks.pending();
    if (this.busy || this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.pump();
    }, this.delay);
  }

  private async pump() {
    this.busy = true;
    try {
      while (this.queued && this.text) {
        this.queued = false;
        const text = this.text;
        const revision = this.revision;
        const started = this.changedAt;
        try {
          const value = await this.callbacks.read(text);
          if (revision === this.revision) {
            this.callbacks.show(value, text, Math.round(performance.now() - started));
          }
        } catch (error) {
          if (revision === this.revision && text === this.text) this.callbacks.error(error);
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
