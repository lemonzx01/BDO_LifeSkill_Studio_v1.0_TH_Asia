import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InfoTip, WithTip } from "./InfoTip";

describe("InfoTip", () => {
  it("is a real button named after its label, closed until used", () => {
    const html = renderToStaticMarkup(<InfoTip label="ROI">กำไร ÷ ต้นทุน</InfoTip>);
    expect(html).toContain('<button type="button"');
    expect(html).toContain('aria-label="ความหมายของ ROI"');
    expect(html).toContain('aria-expanded="false"');
    // the text only renders once opened
    expect(html).not.toContain("กำไร ÷ ต้นทุน");
    expect(html).not.toContain('role="tooltip"');
  });

  it("keeps the ⓘ glyph out of the accessible name", () => {
    const html = renderToStaticMarkup(<InfoTip label="ROI">x</InfoTip>);
    expect(html).toContain('<span aria-hidden="true">ⓘ</span>');
  });
});

describe("WithTip", () => {
  it("shows the label with its ⓘ after it", () => {
    const html = renderToStaticMarkup(<WithTip label="กำไร/ชิ้น" tip="x" />);
    expect(html.indexOf("กำไร/ชิ้น")).toBeLessThan(html.indexOf("ⓘ"));
    expect(html).toContain('aria-label="ความหมายของ กำไร/ชิ้น"');
  });
});
