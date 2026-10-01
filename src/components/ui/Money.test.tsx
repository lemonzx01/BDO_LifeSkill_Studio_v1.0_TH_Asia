import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Money, pctTone, profitTone } from "./Money";

describe("Money tone=profit", () => {
  it("colours by the value as shown: a value that rounds to zero is grey with no sign", () => {
    for (const v of [0.3, -0.3, 0]) {
      const html = renderToStaticMarkup(<Money value={v} tone="profit" />);
      expect(html).toContain("text-muted");
      expect(html).toContain(">0</span>");
    }
    const compact = renderToStaticMarkup(<Money value={-0.3} tone="profit" compact />);
    expect(compact).toContain("text-muted");
    expect(compact).toContain(">0</span>");
  });

  it("is green above zero and red below once the number shows", () => {
    expect(renderToStaticMarkup(<Money value={0.6} tone="profit" />)).toContain("text-good");
    expect(renderToStaticMarkup(<Money value={-0.6} tone="profit" />)).toContain("text-bad");
  });
});

describe("pctTone", () => {
  it("is grey when the percentage reads 0% at the given digits", () => {
    expect(pctTone(0.004)).toBe("muted");
    expect(pctTone(-0.004)).toBe("muted");
    expect(pctTone(0.0004, 1)).toBe("muted");
    expect(pctTone(0.004, 1)).toBe("good");
    expect(pctTone(-0.004, 1)).toBe("bad");
    expect(pctTone(0.5, 0, true)).toBe("muted");
  });

  it("matches profitTone away from zero", () => {
    expect(pctTone(0.25)).toBe(profitTone(0.25));
    expect(pctTone(-0.25)).toBe(profitTone(-0.25));
  });
});
