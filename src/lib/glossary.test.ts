import { describe, expect, it } from "vitest";
import { GLOSSARY, perHourTip } from "./glossary";

describe("perHourTip", () => {
  it("names the one speed a skill group uses", () => {
    expect(perHourTip({ alchemy: 900, cooking: 900, processing: 3000 }, "processing")).toBe("คิดจาก 3,000 รอบ/ชม. ที่ตั้งไว้");
  });

  it("lists every group when no tab narrows it", () => {
    expect(perHourTip({ alchemy: 900, cooking: 1200, processing: 3000 })).toBe("คิดจากรอบ/ชม. ที่ตั้งไว้: แปรธาตุ 900 · ทำอาหาร 1,200 · แปรรูป 3,000");
  });

  it("reads 0 for a speed that was never set", () => {
    expect(perHourTip({}, "cooking")).toBe("คิดจาก 0 รอบ/ชม. ที่ตั้งไว้");
  });
});

describe("GLOSSARY", () => {
  it("keeps every line short enough for the small popover", () => {
    for (const text of Object.values(GLOSSARY)) expect(text.length).toBeLessThanOrEqual(60);
  });
});
