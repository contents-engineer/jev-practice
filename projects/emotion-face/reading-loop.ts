/** A single in-flight request with debounced dispatch. Only current revisions render. */
export class ReadingLoop<T> {
  private text = '';
  private revision = 0;
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readyToPump = false;
  private changedAt = 0;

  constructor(private readonly callbacks: {
    read: (text: string) => Promise<T>;
    show: (value: T, text: string, elapsed: number) => void;
    pending: () => void;
    idle: () => void;
    error: (error: unknown) => void;
  }, private readonly delay = 400) {}

  update(value: string) {
    const text = value.trim();
    if (text === this.text) return;
    this.revision++;
    this.text = text;
    this.changedAt = performance.now();
    this.readyToPump = false;

    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (!text) {
      this.callbacks.idle();
      return;
    }

    this.callbacks.pending();

    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.triggerPump();
    }, this.delay);
  }

  private triggerPump() {
    if (this.busy) {
      this.readyToPump = true;
      return;
    }
    void this.pump();
  }

  private async pump() {
    if (this.busy || !this.text) return;
    this.busy = true;
    this.readyToPump = false;
    try {
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
    } finally {
      this.busy = false;
      if (this.readyToPump && this.text) {
        this.readyToPump = false;
        void this.pump();
      }
    }
  }
}
