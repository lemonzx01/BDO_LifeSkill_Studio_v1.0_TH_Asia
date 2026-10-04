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

  it("keeps its icon out of the accessible name", () => {
    const html = renderToStaticMarkup(<InfoTip label="ROI">x</InfoTip>);
    // the only thing inside the button is the decorative svg: the name comes from aria-label alone
    const inner = html.slice(html.indexOf("<button"), html.indexOf("</button>"));
    expect(inner).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(inner.replace(/<[^>]+>/g, "")).toBe("");
  });
});

describe("WithTip", () => {
  it("shows the label with its help icon after it", () => {
    const html = renderToStaticMarkup(<WithTip label="กำไร/ชิ้น" tip="x" />);
    expect(html.indexOf("กำไร/ชิ้น")).toBeLessThan(html.indexOf("<button"));
    expect(html.indexOf("<button")).toBeLessThan(html.indexOf("<svg"));
    expect(html).toContain('aria-label="ความหมายของ กำไร/ชิ้น"');
  });
});
