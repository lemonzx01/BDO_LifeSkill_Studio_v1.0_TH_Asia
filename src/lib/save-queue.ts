import type { Inventory, ItemId, Settings } from "./engine/types";

/**
 * The one queue that sends a member's changes (settings, inventory, starred items) to the server.
 *
 * It lives in this module, not in a component, so it outlives a page: the providers are per page,
 * and a change made just before a client-side navigation, or one that failed, must not vanish with
 * the page it was made on. The next page lays every change the server may not have yet over its
 * server-rendered copy (jobsFor + the overlay* functions) and keeps sending.
 *
 * Rules it keeps:
 * - every request's answer is checked; a 401 means the session ended (state "authExpired") and
 *   nothing more is sent until retry() or resume() (the next signed-in page); any other failure is kept and retried (twice on its own,
 *   then on retry(), on the `online` event and on the next page)
 * - per key (settings, each item, each favourite) only the newest value is kept, and one request
 *   per key is in flight at a time, so an older value can never land after a newer one
 * - "clear inventory" replaces every inventory change not sent yet, waits for the item requests
 *   already in flight, and holds back later item changes until it has gone through
 * - the queue belongs to one account (claim): another account signing in on this tab drops it
 */

export type SaveState = "idle" | "saving" | "saved" | "error" | "authExpired";

export interface SaveSnapshot {
  state: SaveState;
  /** changes not on the server yet: waiting out their debounce, being sent, held, or failed */
  pending: number;
  /** changes whose last attempt failed */
  failed: number;
  /** goes up each time everything has been saved, so "บันทึกแล้ว" shows once per save */
  savedSeq: number;
}

export type SaveJob =
  | { kind: "settings"; settings: Settings }
  /** avgCost: number = record it, null = clear it (follow the market), undefined = keep the saved one */
  | { kind: "item"; id: ItemId; qty: number; avgCost?: number | null; updatedAt?: number }
  | { kind: "favorite"; id: ItemId; on: boolean }
  | { kind: "clear" };

type Status = "waiting" | "queued" | "sending" | "failed" | "done";

interface Entry {
  /** order of the change; entries are kept sorted by it */
  n: number;
  key: string;
  job: SaveJob;
  status: Status;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface SaveQueueDeps {
  fetch: (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (t: ReturnType<typeof setTimeout>) => void;
}

const defaultDeps: SaveQueueDeps = {
  fetch: (url, init) => fetch(url, init),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
};

export const IDLE_SAVE: SaveSnapshot = { state: "idle", pending: 0, failed: 0, savedSeq: 0 };

/** automatic retries after a failure that is not a 401, before it waits for the member */
const AUTO_RETRIES = 2;
const AUTO_RETRY_MS = 3000;

export function jobKey(job: SaveJob): string {
  switch (job.kind) {
    case "settings":
      return "settings";
    case "item":
      return `item:${job.id}`;
    case "favorite":
      return `fav:${job.id}`;
    case "clear":
      return "clear";
  }
}

const isItem = (key: string) => key.startsWith("item:");
const unsent = (s: Status) => s === "waiting" || s === "queued" || s === "failed";

/**
 * A newer value for the same key replaces an older one that has not reached the server. An item
 * change that says "keep the saved cost" (avgCost undefined) keeps the cost the older one carried,
 * or that cost would never be saved.
 */
export function mergeJobs(older: SaveJob, newer: SaveJob): SaveJob {
  if (older.kind === "item" && newer.kind === "item" && newer.avgCost === undefined && older.avgCost !== undefined) {
    return { ...newer, avgCost: older.avgCost };
  }
  return newer;
}

function request(job: SaveJob): { url: string; init: RequestInit } {
  const put = (url: string, body: unknown) => ({
    url,
    init: { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  });
  switch (job.kind) {
    case "settings":
      return put("/api/user/settings", job.settings);
    case "item":
      // avgCost undefined is left out of the JSON, which the server reads as "keep"
      return put("/api/user/inventory", { id: job.id, qty: job.qty, avgCost: job.avgCost });
    case "favorite":
      return put("/api/user/favorites", { id: job.id, on: job.on });
    case "clear":
      return { url: "/api/user/inventory", init: { method: "DELETE" } };
  }
}

export class SaveQueue {
  private entries: Entry[] = [];
  private n = 0;
  private owner: number | null = null;
  private authExpired = false;
  private justSaved = false;
  private savedSeq = 0;
  private autoRetries = 0;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshot: SaveSnapshot = IDLE_SAVE;
  private listeners = new Set<() => void>();
  private doneListeners = new Set<(job: SaveJob) => void>();
  private settledWaiters = new Set<() => void>();
  private readonly deps: SaveQueueDeps;

  constructor(deps: SaveQueueDeps = defaultDeps) {
    this.deps = deps;
  }

  // arrow properties: useSyncExternalStore needs stable functions
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): SaveSnapshot => this.snapshot;

  /** Called with each change the server has confirmed (e.g. to reload the starred items). */
  onDone(fn: (job: SaveJob) => void): () => void {
    this.doneListeners.add(fn);
    return () => {
      this.doneListeners.delete(fn);
    };
  }

  /** Makes the queue this account's; anything left from another account on this tab is dropped. */
  claim(owner: number): void {
    if (this.owner !== null && this.owner !== owner) {
      for (const e of this.entries) this.stopTimer(e);
      this.entries = [];
      this.authExpired = false;
      this.justSaved = false;
      this.autoRetries = 0;
      if (this.autoTimer) this.deps.clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    this.owner = owner;
    this.emit();
  }

  /**
   * The changes, oldest first, that a page rendered now may not include: not confirmed yet, or
   * confirmed since the last page change. Empty for any other account.
   */
  jobsFor(owner: number): SaveJob[] {
    if (this.owner !== null && this.owner !== owner) return [];
    return this.entries.map((e) => e.job);
  }

  hasFailed(): boolean {
    return this.entries.some((e) => e.status === "failed");
  }

  /** Nothing more is on its way: no change waiting, queued or being sent (or a 401 holds them all back). */
  isSettled(): boolean {
    return this.authExpired || !this.entries.some((e) => e.status === "waiting" || e.status === "queued" || e.status === "sending");
  }

  /**
   * Resolves once isSettled(), or after `timeoutMs` at the latest (e.g. to let the saves just
   * flushed reach the server before signing out). Failed changes do not hold it up.
   */
  whenSettled(timeoutMs: number): Promise<void> {
    if (this.isSettled()) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        this.deps.clearTimeout(timer);
        this.settledWaiters.delete(done);
        resolve();
      };
      const timer = this.deps.setTimeout(done, timeoutMs);
      this.settledWaiters.add(done);
    });
  }

  /** Queues a change. `delayMs` debounces it: another change for the same key within that time replaces it. */
  enqueue(job: SaveJob, delayMs = 0): void {
    const key = jobKey(job);
    if (job.kind === "clear") {
      // clearing makes every unsent inventory change (and an unsent earlier clear) pointless
      this.entries = this.entries.filter((e) => {
        if (unsent(e.status) && (isItem(e.key) || e.key === "clear")) {
          this.stopTimer(e);
          return false;
        }
        return true;
      });
    }
    let next = job;
    const prev = this.entries.find((e) => e.key === key && unsent(e.status));
    if (prev) {
      next = mergeJobs(prev.job, job);
      this.stopTimer(prev);
      this.entries = this.entries.filter((e) => e !== prev);
    }
    const entry: Entry = { n: ++this.n, key, job: next, status: delayMs > 0 ? "waiting" : "queued", timer: null };
    if (delayMs > 0) {
      entry.timer = this.deps.setTimeout(() => {
        entry.timer = null;
        if (entry.status === "waiting") {
          entry.status = "queued";
          this.pump(false);
        }
      }, delayMs);
    }
    this.entries.push(entry);
    this.justSaved = false;
    this.pump(false);
  }

  /**
   * Sends every change still waiting out its debounce right now. `keepalive` lets the requests
   * finish after the page is gone (pagehide, or a provider unmounting as the tab closes).
   */
  flush(keepalive: boolean): void {
    for (const e of this.entries) {
      if (e.status === "waiting") {
        this.stopTimer(e);
        e.status = "queued";
      }
    }
    this.pump(keepalive);
  }

  /** Sends every failed change again (also after a 401, e.g. once the member has signed back in). */
  retry = (): void => {
    this.autoRetries = 0;
    this.authExpired = false;
    this.requeueFailed();
  };

  /**
   * A signed-in page has just rendered, so the session is good again: send what a 401 held back and
   * what failed. Looks at the session state too, not only at failures: a 401 can leave no change
   * marked failed (it was folded into a newer value of the same key that is still queued, or
   * dropped because the inventory was cleared later), and that newer value must go out as well.
   */
  resume = (): void => {
    if (this.authExpired || this.hasFailed()) this.retry();
  };

  /**
   * A page change has started: confirmed changes are in whatever the server renders from now on,
   * so they no longer need to be laid over the next page. (Browser back/forward shows a page as it
   * was first rendered instead; UserDataProvider reloads the account's data for that case.)
   */
  markNavigation(): void {
    this.entries = this.entries.filter((e) => e.status !== "done");
    this.justSaved = false;
    this.emit();
  }

  private requeueFailed(): void {
    for (const e of this.entries) if (e.status === "failed") e.status = "queued";
    this.pump(false);
  }

  private stopTimer(e: Entry): void {
    if (e.timer) this.deps.clearTimeout(e.timer);
    e.timer = null;
  }

  private canSend(e: Entry): boolean {
    for (const o of this.entries) {
      if (o === e) continue;
      // one request per key at a time
      if (o.key === e.key && o.status === "sending") return false;
      // a clear goes after the item requests already on their way
      if (e.key === "clear" && isItem(o.key) && o.status === "sending") return false;
      // item changes made after a clear wait until the clear has gone through
      if (isItem(e.key) && o.key === "clear" && o.n < e.n && o.status !== "done") return false;
    }
    return true;
  }

  private pump(keepalive: boolean): void {
    if (!this.authExpired) {
      for (const e of this.entries) {
        if (e.status === "queued" && this.canSend(e)) this.send(e, keepalive);
      }
    }
    this.emit();
  }

  private send(e: Entry, keepalive: boolean): void {
    e.status = "sending";
    const { url, init } = request(e.job);
    this.deps
      .fetch(url, keepalive ? { ...init, keepalive: true } : init)
      .then((res) => this.settle(e, res.ok ? "ok" : res.status === 401 ? "auth" : "fail"))
      .catch(() => this.settle(e, "fail"));
  }

  private settle(e: Entry, outcome: "ok" | "auth" | "fail"): void {
    // dropped meanwhile (another account claimed the queue)
    if (!this.entries.includes(e)) return;
    if (outcome === "ok") {
      e.status = "done";
      // older confirmed values of the same key are history now
      this.entries = this.entries.filter((o) => !(o.key === e.key && o.status === "done" && o.n < e.n));
      this.autoRetries = 0;
      for (const fn of this.doneListeners) fn(e.job);
      if (!this.entries.some((o) => o.status !== "done")) {
        this.justSaved = true;
        this.savedSeq += 1;
      }
    } else {
      const newer = this.entries.find((o) => o.key === e.key && o.n > e.n && unsent(o.status));
      const clearedLater = isItem(e.key) && this.entries.some((o) => o.key === "clear" && o.n > e.n);
      if (newer) {
        // a newer value for this key is still to be sent: it carries this one's cost if needed
        newer.job = mergeJobs(e.job, newer.job);
        this.entries = this.entries.filter((o) => o !== e);
      } else if (clearedLater) {
        // the inventory was cleared after this change, so it no longer matters
        this.entries = this.entries.filter((o) => o !== e);
      } else {
        e.status = "failed";
      }
      if (outcome === "auth") this.authExpired = true;
      else this.scheduleAutoRetry();
    }
    this.pump(false);
  }

  private scheduleAutoRetry(): void {
    if (this.autoTimer || this.autoRetries >= AUTO_RETRIES) return;
    const wait = AUTO_RETRY_MS * (this.autoRetries + 1);
    this.autoTimer = this.deps.setTimeout(() => {
      this.autoTimer = null;
      this.autoRetries += 1;
      // after a 401 only the member's own retry (or a new page) sends again
      if (!this.authExpired) this.requeueFailed();
    }, wait);
  }

  private emit(): void {
    if (this.settledWaiters.size > 0 && this.isSettled()) for (const fn of [...this.settledWaiters]) fn();
    const pending = this.entries.filter((e) => e.status !== "done").length;
    const failed = this.entries.filter((e) => e.status === "failed").length;
    const state: SaveState = this.authExpired
      ? "authExpired"
      : failed > 0
        ? "error"
        : pending > 0
          ? "saving"
          : this.justSaved
            ? "saved"
            : "idle";
    const s = this.snapshot;
    if (s.state === state && s.pending === pending && s.failed === failed && s.savedSeq === this.savedSeq) return;
    this.snapshot = { state, pending, failed, savedSeq: this.savedSeq };
    for (const fn of this.listeners) fn();
  }
}

/** The tab's queue (the server never enqueues: changes only come from event handlers). */
export const saveQueue = new SaveQueue();

/** The server's settings with this tab's newer ones laid over. */
export function overlaySettings(base: Settings, jobs: readonly SaveJob[]): Settings {
  let out = base;
  for (const j of jobs) if (j.kind === "settings") out = j.settings;
  return out;
}

/** The server's inventory with this tab's newer changes (and clears) applied in order. */
export function overlayInventory(base: Inventory, jobs: readonly SaveJob[]): Inventory {
  if (!jobs.some((j) => j.kind === "item" || j.kind === "clear")) return base;
  let out: Inventory = { ...base };
  for (const j of jobs) {
    if (j.kind === "clear") out = {};
    else if (j.kind === "item") {
      if (j.qty > 0) {
        const cur = out[j.id];
        out[j.id] = { qty: j.qty, avgCost: j.avgCost === null ? undefined : (j.avgCost ?? cur?.avgCost), updatedAt: j.updatedAt ?? cur?.updatedAt };
      } else delete out[j.id];
    }
  }
  return out;
}

/** The server's starred ids with this tab's newer stars and unstars applied in order. */
export function overlayFavorites(base: readonly ItemId[], jobs: readonly SaveJob[]): ItemId[] {
  let out = [...base];
  for (const j of jobs) {
    if (j.kind !== "favorite") continue;
    out = out.filter((id) => id !== j.id);
    if (j.on) out.push(j.id);
  }
  return out;
}
