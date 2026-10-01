import { describe, expect, it } from "vitest";
import { buildPerfRecord, clampPerfNumber, PERF_MAX } from "./perf";

const AT = new Date("2026-10-01T00:00:00Z");

describe("buildPerfRecord", () => {
  it("stores an allow-listed page under its fixed key, without any account name", () => {
    const rec = buildPerfRecord({ page: "market", user: "someone", username: "x", rows: 2800, ttfbMs: 412.6, fullLoad: true, mobile: false, connection: "4g" }, AT);
    expect(rec?.key).toBe("timing_market_client");
    expect(rec?.data).toMatchObject({ at: AT.toISOString(), rows: 2800, ttfbMs: 413, fullLoad: true, mobile: false, connection: "4g" });
    expect(rec?.data).not.toHaveProperty("user");
    expect(rec?.data).not.toHaveProperty("username");
    expect(rec?.data.scriptBytes).toBeNull(); // missing numbers are null
  });

  it("refuses pages that are not on the allow-list", () => {
    for (const page of ["recipes", "Market", "market_page", "", undefined, 5, "x".repeat(20)]) {
      expect(buildPerfRecord({ page }, AT), String(page)).toBeNull();
    }
    expect(buildPerfRecord(null, AT)).toBeNull();
    expect(buildPerfRecord("market", AT)).toBeNull();
  });

  it("clamps numbers and drops odd connection labels", () => {
    const rec = buildPerfRecord({ page: "market", transferBytes: 1e15, mountedMs: -50, rows: "12", connection: "<script>" }, AT);
    expect(rec?.data.transferBytes).toBe(PERF_MAX);
    expect(rec?.data.mountedMs).toBe(0);
    expect(rec?.data.rows).toBeNull();
    expect(rec?.data.connection).toBeNull();
  });
});

describe("clampPerfNumber", () => {
  it("keeps whole numbers within 0..PERF_MAX", () => {
    expect(clampPerfNumber(1.4)).toBe(1);
    expect(clampPerfNumber(-1)).toBe(0);
    expect(clampPerfNumber(PERF_MAX + 1)).toBe(PERF_MAX);
    expect(clampPerfNumber(Number.NaN)).toBeNull();
    expect(clampPerfNumber(Infinity)).toBeNull();
  });
});
