/** Best-effort bounds per warm server instance, not a distributed quota.
 * Counts admitted logical requests, including failures; SDK retries are additional.
 */
export class RequestBudget {
  private minute = -1;
  private day = -1;
  private minuteCount = 0;
  private dayCount = 0;
  private active = 0;

  constructor(private readonly limits = { perMinute: 120, perDay: 2_000, concurrent: 4 }) {}

  acquire(now = Date.now()): (() => void) | undefined {
    const minute = Math.floor(now / 60_000);
    const day = Math.floor(now / 86_400_000);
    if (minute !== this.minute) { this.minute = minute; this.minuteCount = 0; }
    if (day !== this.day) { this.day = day; this.dayCount = 0; }
    if (this.minuteCount >= this.limits.perMinute || this.dayCount >= this.limits.perDay || this.active >= this.limits.concurrent) return;
    this.minuteCount++;
    this.dayCount++;
    this.active++;
    let released = false;
    return () => {
      if (!released) this.active--;
      released = true;
    };
  }
}
