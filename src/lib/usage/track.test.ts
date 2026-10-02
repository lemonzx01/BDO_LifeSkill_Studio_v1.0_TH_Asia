import { describe, expect, it } from "vitest";
import { columnPath, labelStep, yTicks } from "./chart";
import { count, dailyCsv, dayLabel, decimal, share } from "./format";
import { addDays, bangkokDay, isBotUserAgent, isSameOrigin, isVisitorId, normalizePath, parseTrackBody, PATH_LABEL, TRACKED_PATHS } from "./track";

const VID = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

describe("normalizePath", () => {
  it("keeps every known page as it is", () => {
    for (const p of TRACKED_PATHS) expect(normalizePath(p)).toBe(p);
  });

  it("drops the query string, the hash and a trailing slash", () => {
    expect(normalizePath("/recipes?q=ยาแห่งการปลุกพลัง")).toBe("/recipes");
    expect(normalizePath("/market#top")).toBe("/market");
    expect(normalizePath("/calc/")).toBe("/calc");
    expect(normalizePath("/admin/stats/")).toBe("/admin/stats");
    expect(normalizePath("/?from=home")).toBe("/");
    expect(normalizePath("//")).toBe("/");
  });

  it("counts anything else as other", () => {
    for (const p of ["", "/setup", "/Recipes", "/recipes/123", "/admin/users", "/api/track", "https://evil.example/", "/../admin", "recipes"]) {
      expect(normalizePath(p), p).toBe("other");
    }
    expect(normalizePath("/" + "a".repeat(400))).toBe("other");
  });

  it("has a Thai name for every page it can return", () => {
    for (const p of [...TRACKED_PATHS, "other" as const]) expect(PATH_LABEL[p]).toBeTruthy();
  });
});

describe("report validation", () => {
  it("accepts a random UUID and lower-cases it", () => {
    expect(isVisitorId(VID)).toBe(true);
    expect(parseTrackBody({ vid: VID.toUpperCase(), path: "/market?x=1" })).toEqual({ vid: VID, path: "/market" });
  });

  it("rejects anything that is not a version-4 UUID", () => {
    for (const vid of [
      undefined,
      null,
      42,
      "",
      "not-a-uuid",
      VID + "0",
      ` ${VID}`,
      "3f2b8c1e-9a4d-1e6f-8b2a-1c3d5e7f9a0b", // version 1
      "3f2b8c1e-9a4d-4e6f-7b2a-1c3d5e7f9a0b", // wrong variant
      "3f2b8c1e9a4d4e6f8b2a1c3d5e7f9a0b",
    ]) {
      expect(isVisitorId(vid), String(vid)).toBe(false);
      expect(parseTrackBody({ vid, path: "/" })).toBeNull();
    }
  });

  it("needs an object with a string path", () => {
    expect(parseTrackBody(null)).toBeNull();
    expect(parseTrackBody("x")).toBeNull();
    expect(parseTrackBody([VID, "/"])).toBeNull();
    expect(parseTrackBody({ vid: VID })).toBeNull();
    expect(parseTrackBody({ vid: VID, path: 5 })).toBeNull();
    expect(parseTrackBody({ vid: VID, path: "/nowhere" })).toEqual({ vid: VID, path: "other" });
  });
});

describe("isBotUserAgent", () => {
  const browsers = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0",
    "Mozilla/5.0 (Linux; Android 13; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  ];
  const bots = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36",
    "Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "TelegramBot (like TwitterBot)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "node",
    "",
  ];
  it("lets real browsers through", () => {
    for (const ua of browsers) expect(isBotUserAgent(ua), ua).toBe(false);
  });
  it("stops crawlers, previews, headless browsers and scripts", () => {
    for (const ua of bots) expect(isBotUserAgent(ua), ua).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
  });
});

describe("isSameOrigin", () => {
  it("allows no Origin header and this site's own origin", () => {
    expect(isSameOrigin(null, ["bdo.example.com"])).toBe(true);
    expect(isSameOrigin("https://bdo.example.com", ["bdo.example.com"])).toBe(true);
    expect(isSameOrigin("http://localhost:4500", ["localhost:4500"])).toBe(true);
    expect(isSameOrigin("https://BDO.example.com", [null, "bdo.example.com"])).toBe(true);
  });
  it("refuses other sites, other ports and the opaque null origin", () => {
    expect(isSameOrigin("https://evil.example", ["bdo.example.com"])).toBe(false);
    expect(isSameOrigin("https://bdo.example.com.evil.example", ["bdo.example.com"])).toBe(false);
    expect(isSameOrigin("http://localhost:3000", ["localhost:4500"])).toBe(false);
    expect(isSameOrigin("null", ["bdo.example.com"])).toBe(false);
    expect(isSameOrigin("https://bdo.example.com", [null, undefined])).toBe(false);
  });
});

describe("days in Asia/Bangkok", () => {
  it("turns over at midnight Bangkok time (17:00 UTC)", () => {
    expect(bangkokDay(new Date("2026-10-01T16:59:59.999Z"))).toBe("2026-10-01");
    expect(bangkokDay(new Date("2026-10-01T17:00:00.000Z"))).toBe("2026-10-02");
    // 06:59 on 2 Oct in Bangkok is still 1 Oct in UTC
    expect(bangkokDay(new Date("2026-10-01T23:59:00Z"))).toBe("2026-10-02");
    // new year in Bangkok comes seven hours before UTC's
    expect(bangkokDay(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
  });

  it("matches the time zone database", () => {
    const tz = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 7 * 3600_000 + 13 * 60_000) {
      expect(bangkokDay(new Date(t))).toBe(tz.format(t));
    }
  });

  it("adds days across months and leap years", () => {
    expect(addDays("2026-10-02", -29)).toBe("2026-09-03");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-02", 0)).toBe("2026-10-02");
  });
});

describe("stats page formatting", () => {
  it("writes Thai dates by hand, with the Buddhist year on request", () => {
    expect(dayLabel("2026-10-02")).toBe("2 ต.ค.");
    expect(dayLabel("2026-01-31", true)).toBe("31 ม.ค. 2569");
    expect(dayLabel("bad")).toBe("bad");
  });

  it("formats counts, averages and shares", () => {
    expect(count(1234)).toBe("1,234");
    expect(count(0)).toBe("0");
    expect(decimal(4.25)).toBe("4.3");
    expect(decimal(4)).toBe("4");
    expect(decimal(NaN)).toBe("0");
    expect(share(1, 3)).toBe("33%");
    expect(share(0, 0)).toBe("0%");
  });

  it("builds the daily CSV with ISO dates and a BOM for Excel", () => {
    const csv = dailyCsv([
      { day: "2026-10-01", visitors: 3, views: 10 },
      { day: "2026-10-02", visitors: 0, views: 0 },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual(["วันที่,ผู้ใช้ (คน),เปิดหน้า (ครั้ง)", "2026-10-01,3,10", "2026-10-02,0,0"]);
  });
});

describe("chart geometry", () => {
  it("picks round y-axis steps that cover the highest day", () => {
    expect(yTicks(0)).toEqual([0, 1]);
    expect(yTicks(1)).toEqual([0, 1]);
    expect(yTicks(3)).toEqual([0, 1, 2, 3]);
    expect(yTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(yTicks(13)).toEqual([0, 5, 10, 15]);
    expect(yTicks(120)).toEqual([0, 50, 100, 150]);
    expect(yTicks(1000)).toEqual([0, 500, 1000]);
    for (const max of [1, 2, 9, 17, 33, 99, 101, 2500]) {
      const t = yTicks(max);
      expect(t[t.length - 1], String(max)).toBeGreaterThanOrEqual(max);
      expect(t.length, String(max)).toBeLessThanOrEqual(6);
      expect(t.every(Number.isInteger)).toBe(true);
    }
  });

  it("rounds only the top of a column, and never by more than half its width or its height", () => {
    expect(columnPath(10, 20, 12, 50)).toBe("M10,70V24Q10,20 14,20H18Q22,20 22,24V70Z");
    expect(columnPath(0, 0, 2, 50)).toContain("Q0,0 1,0");
    expect(columnPath(0, 49, 10, 1)).toBe("M0,50V50Q0,49 1,49H9Q10,49 10,50V50Z");
  });

  it("spaces the date labels at least 64px apart", () => {
    expect(labelStep(20)).toBe(4);
    expect(labelStep(64)).toBe(1);
    expect(labelStep(100)).toBe(1);
    expect(labelStep(3.3)).toBe(20);
  });
});
