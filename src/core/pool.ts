// ─── Object Pool ───
// Generic object pool for bullets, zombies, particles, XP gems.
// Avoids GC pressure by reusing objects.

export class Pool<T> {
  private pool: T[] = [];
  private active: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, prealloc = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < prealloc; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    const obj = this.pool.length > 0 ? this.pool.pop()! : this.factory();
    this.active.push(obj);
    return obj;
  }

  release(obj: T): void {
    const idx = this.active.indexOf(obj);
    if (idx !== -1) {
      this.active[idx] = this.active[this.active.length - 1];
      this.active.pop();
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  releaseAll(): void {
    for (const obj of this.active) {
      this.reset(obj);
      this.pool.push(obj);
    }
    this.active.length = 0;
  }

  getActive(): readonly T[] {
    return this.active;
  }

  get activeCount(): number {
    return this.active.length;
  }

  /** Iterate and allow releasing during iteration */
  forEach(fn: (obj: T) => boolean | void): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const shouldRelease = fn(this.active[i]);
      if (shouldRelease === true) {
        this.reset(this.active[i]);
        this.pool.push(this.active[i]);
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
      }
    }
  }
}
