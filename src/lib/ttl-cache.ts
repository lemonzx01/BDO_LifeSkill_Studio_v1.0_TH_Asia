/**
 * Small per-instance cache with an expiry and a size cap: when full, the entry written
 * longest ago is dropped, so memory stays bounded however many keys are requested.
 */
export class TtlCache<K, V> {
  private readonly map = new Map<K, { at: number; value: V }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: K, now: number): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (now - e.at >= this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: K, value: V, now: number): void {
    // re-inserting moves the key to the end, so insertion order stays "oldest write first"
    this.map.delete(key);
    this.map.set(key, { at: now, value });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }

  get size(): number {
    return this.map.size;
  }
}
