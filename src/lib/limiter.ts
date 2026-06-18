// Minimal FIFO concurrency limiter. Caps how many operations run at once;
// excess callers queue until a slot frees. `active` counts granted slots — on
// release, a waiting slot is handed off directly (active stays put) so the count
// never drifts.
export class Limiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  // Acquire a slot, returning an idempotent release function. Prefer run() when
  // the work is a single awaited call; use acquire() when the slot must be freed
  // on an external signal (e.g. a stream becoming readable).
  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
    } else {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    };
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
