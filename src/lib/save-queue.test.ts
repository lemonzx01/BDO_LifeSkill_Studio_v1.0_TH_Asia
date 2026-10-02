import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./engine/types";
import { overlayFavorites, overlayInventory, overlaySettings, SaveQueue, type SaveJob } from "./save-queue";

interface Call {
  url: string;
  method: string;
  body: unknown;
  keepalive: boolean;
  answer: (status: number) => Promise<void>;
  fail: () => Promise<void>;
}

/** A queue whose requests stay open until the test answers them. */
function setup() {
  const calls: Call[] = [];
  const q = new SaveQueue({
    fetch: (url, init) =>
      new Promise((resolve, reject) => {
        const settle = async (fn: () => void) => {
          fn();
          // let the queue's .then/.catch run
          await Promise.resolve();
          await Promise.resolve();
        };
        calls.push({
          url,
          method: String(init.method),
          body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
          keepalive: init.keepalive === true,
          answer: (status) => settle(() => resolve({ ok: status >= 200 && status < 300, status })),
          fail: () => settle(() => reject(new TypeError("Failed to fetch"))),
        });
      }),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (t) => clearTimeout(t),
  });
  q.claim(1);
  return { q, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SaveQueue", () => {
  it("debounces, sends the newest value only, and reports saving then saved", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "settings", settings: { ...DEFAULT_SETTINGS, valuePack: false } }, 600);
    q.enqueue({ kind: "settings", settings: { ...DEFAULT_SETTINGS, valuePack: true } }, 600);
    expect(q.getSnapshot().state).toBe("saving");
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(600);
    expect(calls).toHaveLength(1);
    expect((calls[0].body as { valuePack: boolean }).valuePack).toBe(true);
    await calls[0].answer(200);
    expect(q.getSnapshot()).toMatchObject({ state: "saved", pending: 0, savedSeq: 1 });
  });

  it("allSaved() is true only once every change has been confirmed (a failed one keeps it false)", async () => {
    const { q, calls } = setup();
    expect(q.allSaved()).toBe(true);
    q.enqueue({ kind: "item", id: 1, qty: 2 }, 400);
    q.enqueue({ kind: "favorite", id: 1, on: true });
    expect(q.allSaved()).toBe(false);
    q.flush(false);
    await calls[0].answer(200);
    expect(q.allSaved()).toBe(false);
    await calls[1].answer(500);
    expect(q.allSaved()).toBe(false);
    q.retry();
    await calls[2].answer(200);
    expect(q.allSaved()).toBe(true);
  });

  it("checks the answer: a 500 is kept as failed and sent again by retry()", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "favorite", id: 5, on: true });
    await calls[0].answer(500);
    expect(q.getSnapshot()).toMatchObject({ state: "error", failed: 1 });
    q.retry();
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual({ id: 5, on: true });
    await calls[1].answer(200);
    expect(q.getSnapshot().state).toBe("saved");
  });

  it("retries a network failure on its own a couple of times", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "favorite", id: 5, on: true });
    await calls[0].fail();
    expect(q.getSnapshot().state).toBe("error");
    vi.advanceTimersByTime(3000);
    expect(calls).toHaveLength(2);
    await calls[1].fail();
    vi.advanceTimersByTime(6000);
    expect(calls).toHaveLength(3);
    await calls[2].fail();
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(3);
    expect(q.getSnapshot().state).toBe("error");
  });

  it("a 401 stops sending until retry(), and says the session ended", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "favorite", id: 5, on: true });
    await calls[0].answer(401);
    expect(q.getSnapshot().state).toBe("authExpired");
    q.enqueue({ kind: "favorite", id: 6, on: true });
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(1);
    q.retry();
    expect(calls.map((c) => c.body)).toEqual([
      { id: 5, on: true },
      { id: 5, on: true },
      { id: 6, on: true },
    ]);
  });

  it("resume() on the next signed-in page sends a newer value a 401 left queued with nothing failed", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "settings", settings: { ...DEFAULT_SETTINGS, valuePack: false } });
    q.enqueue({ kind: "settings", settings: { ...DEFAULT_SETTINGS, valuePack: true } });
    expect(calls).toHaveLength(1);
    await calls[0].answer(401);
    // the 401'd value was folded into the newer one: nothing is marked failed
    expect(q.getSnapshot()).toMatchObject({ state: "authExpired", pending: 1, failed: 0 });
    // the next page after signing back in, same account
    q.claim(1);
    q.resume();
    expect(calls).toHaveLength(2);
    expect((calls[1].body as { valuePack: boolean }).valuePack).toBe(true);
    await calls[1].answer(200);
    expect(q.getSnapshot()).toMatchObject({ state: "saved", pending: 0 });
  });

  it("resume() also sends a clear a 401 held back after dropping the item change it replaced", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "item", id: 1, qty: 1 });
    q.enqueue({ kind: "clear" });
    await calls[0].answer(401);
    expect(q.getSnapshot()).toMatchObject({ state: "authExpired", pending: 1, failed: 0 });
    q.resume();
    expect(calls.map((c) => c.method)).toEqual(["PUT", "DELETE"]);
    await calls[1].answer(200);
    expect(q.getSnapshot().state).toBe("saved");
  });

  it("resume() leaves a healthy queue alone", () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "favorite", id: 5, on: true });
    q.resume();
    expect(calls).toHaveLength(1);
    expect(q.getSnapshot().state).toBe("saving");
  });

  it("whenSettled() waits for the requests on their way, or for the timeout at the latest", async () => {
    const { q, calls } = setup();
    let settled = false;
    await q.whenSettled(2000);
    q.enqueue({ kind: "favorite", id: 5, on: true }, 400);
    q.flush(false);
    void q.whenSettled(2000).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await calls[0].answer(200);
    await Promise.resolve();
    expect(settled).toBe(true);
    // a request that never answers
    let timedOut = false;
    q.enqueue({ kind: "favorite", id: 6, on: true });
    void q.whenSettled(2000).then(() => {
      timedOut = true;
    });
    vi.advanceTimersByTime(1999);
    await Promise.resolve();
    expect(timedOut).toBe(false);
    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(timedOut).toBe(true);
  });

  it("never has two requests for one key in flight, so an older value cannot land last", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "item", id: 7, qty: 1 });
    q.enqueue({ kind: "item", id: 7, qty: 2 });
    q.enqueue({ kind: "item", id: 7, qty: 3 });
    expect(calls).toHaveLength(1);
    await calls[0].answer(200);
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual({ id: 7, qty: 3 });
  });

  it("keeps a recorded cost when a newer change for the item says 'keep the cost'", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "item", id: 7, qty: 5, avgCost: 300 }, 400);
    q.enqueue({ kind: "item", id: 7, qty: 6 }, 400);
    vi.advanceTimersByTime(400);
    expect(calls[0].body).toEqual({ id: 7, qty: 6, avgCost: 300 });
    // and when the one carrying the cost failed while the newer one waited
    await calls[0].answer(200);
    q.enqueue({ kind: "item", id: 8, qty: 1, avgCost: null });
    q.enqueue({ kind: "item", id: 8, qty: 2 }, 400);
    await calls[1].answer(500);
    vi.advanceTimersByTime(400);
    expect(calls[2].body).toEqual({ id: 8, qty: 2, avgCost: null });
  });

  it("orders a clear after item requests in flight and before later item changes", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "item", id: 1, qty: 1 });
    q.enqueue({ kind: "item", id: 2, qty: 1 }, 400);
    q.enqueue({ kind: "clear" });
    q.enqueue({ kind: "item", id: 3, qty: 1 });
    // item 1 is on its way; item 2 was not sent yet and is dropped by the clear
    expect(calls.map((c) => c.method)).toEqual(["PUT"]);
    await calls[0].answer(200);
    expect(calls.map((c) => c.method)).toEqual(["PUT", "DELETE"]);
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(2);
    await calls[1].answer(200);
    expect(calls).toHaveLength(3);
    expect(calls[2].body).toEqual({ id: 3, qty: 1 });
  });

  it("flush() sends what is waiting right away, with keepalive when the page is going", () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "settings", settings: DEFAULT_SETTINGS }, 600);
    q.flush(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].keepalive).toBe(true);
  });

  it("hands the next page what it may not have yet, and forgets it after the following page change", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "item", id: 1, qty: 4 });
    q.markNavigation();
    await calls[0].answer(200);
    // confirmed after the page change started: the new page's server render may predate it
    expect(q.jobsFor(1)).toHaveLength(1);
    q.markNavigation();
    expect(q.jobsFor(1)).toHaveLength(0);
  });

  it("on a guest page shows and sends nothing, and keeps the account's changes for when it signs back in", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "favorite", id: 5, on: true });
    await calls[0].answer(401);
    expect(q.getSnapshot().state).toBe("authExpired");
    // the session ended and the member is now browsing the public pages without it
    q.enterGuest();
    expect(q.getSnapshot()).toMatchObject({ state: "idle", pending: 0, failed: 0 });
    expect(q.isSettled()).toBe(true);
    q.retry();
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(1);
    expect(q.getSnapshot().state).toBe("idle");
    // signed back in as the same account: the change goes out
    q.claim(1);
    q.resume();
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual({ id: 5, on: true });
    expect(q.getSnapshot().state).toBe("saving");
  });

  it("drops another account's changes", async () => {
    const { q, calls } = setup();
    q.enqueue({ kind: "favorite", id: 5, on: true });
    expect(q.jobsFor(2)).toEqual([]);
    q.claim(2);
    await calls[0].answer(500);
    expect(q.getSnapshot()).toMatchObject({ state: "idle", pending: 0 });
    expect(q.jobsFor(2)).toEqual([]);
  });
});

describe("overlays", () => {
  const jobs: SaveJob[] = [
    { kind: "item", id: 1, qty: 9 },
    { kind: "clear" },
    { kind: "item", id: 2, qty: 3, avgCost: 50, updatedAt: 10 },
    { kind: "item", id: 3, qty: 0 },
    { kind: "favorite", id: 4, on: false },
    { kind: "favorite", id: 5, on: true },
    { kind: "settings", settings: { ...DEFAULT_SETTINGS, ownedCostMode: "avg" } },
  ];

  it("applies inventory changes and clears in order", () => {
    expect(overlayInventory({ 1: { qty: 1 }, 3: { qty: 2 } }, jobs)).toEqual({ 2: { qty: 3, avgCost: 50, updatedAt: 10 } });
    const base = { 1: { qty: 1, avgCost: 7 } };
    expect(overlayInventory(base, [])).toBe(base);
    expect(overlayInventory(base, [{ kind: "item", id: 1, qty: 2 }])[1]).toEqual({ qty: 2, avgCost: 7, updatedAt: undefined });
    expect(overlayInventory(base, [{ kind: "item", id: 1, qty: 2, avgCost: null }])[1]?.avgCost).toBeUndefined();
  });

  it("applies stars and settings", () => {
    expect(overlayFavorites([4, 6], jobs)).toEqual([6, 5]);
    expect(overlaySettings(DEFAULT_SETTINGS, jobs).ownedCostMode).toBe("avg");
    expect(overlaySettings(DEFAULT_SETTINGS, [])).toBe(DEFAULT_SETTINGS);
  });
});
