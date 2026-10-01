import { describe, expect, it } from "vitest";
import { readsAsZero, signed, signedPct, silver, silverShort } from "./format";

describe("silver", () => {
  it("never prints -0", () => {
    expect(silver(-0.3)).toBe("0");
    expect(silver(-0)).toBe("0");
    expect(silver(-0.6)).toBe("-1");
  });
});

describe("readsAsZero", () => {
  it("is true only when no digit is above zero", () => {
    expect(readsAsZero("0")).toBe(true);
    expect(readsAsZero("-0")).toBe(true);
    expect(readsAsZero("0.0%")).toBe(true);
    expect(readsAsZero("10")).toBe(false);
    expect(readsAsZero("-0.1%")).toBe(false);
  });
});

describe("signed", () => {
  it("puts + in front of a positive number only", () => {
    expect(signed(1234)).toBe("+1,234");
    expect(signed(-1234)).toBe("-1,234");
    expect(signed(0)).toBe("0");
  });

  it("decides the sign on the rounded text, so a value that rounds to zero reads 0", () => {
    expect(signed(0.3)).toBe("0");
    expect(signed(-0.3)).toBe("0");
    expect(signed(0.3, silverShort)).toBe("0");
    expect(signed(-0.3, silverShort)).toBe("0");
    expect(signed(0.6)).toBe("+1");
    expect(signed(-0.6)).toBe("-1");
  });

  it("uses the formatter it is given", () => {
    expect(signed(1_234_567, silverShort)).toBe("+1.23M");
    expect(signed(-12_345, silverShort)).toBe("-12.3K");
  });

  it("leaves a value that is not a number to the formatter", () => {
    expect(signed(Number.POSITIVE_INFINITY)).toBe("-");
    expect(signed(Number.NaN)).toBe("-");
  });
});

describe("signedPct", () => {
  it("formats a ratio as a signed percentage", () => {
    expect(signedPct(0.125)).toBe("+13%");
    expect(signedPct(-0.05)).toBe("-5%");
    expect(signedPct(0.1234, 1)).toBe("+12.3%");
    expect(signedPct(0)).toBe("0%");
  });

  it("reads 0% when the ratio rounds to zero at the given digits", () => {
    expect(signedPct(0.004)).toBe("0%");
    expect(signedPct(-0.004)).toBe("0%");
    expect(signedPct(0.0004, 1)).toBe("0.0%");
    expect(signedPct(0.004, 1)).toBe("+0.4%");
  });
});
