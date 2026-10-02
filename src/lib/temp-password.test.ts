import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateTempPassword, TEMP_PASSWORD_ALPHABET, TEMP_PASSWORD_LENGTH, tempLoginText, type RandomBytes } from "./temp-password";

const realRandom: RandomBytes = (b) => webcrypto.getRandomValues(b);

/** A random source that hands out the given bytes in order, then repeats them. */
function fixed(bytes: number[]): RandomBytes {
  let i = 0;
  return (buf) => {
    for (let k = 0; k < buf.length; k++) buf[k] = bytes[i++ % bytes.length];
    return buf;
  };
}

describe("TEMP_PASSWORD_ALPHABET", () => {
  it("has no characters that are easy to mix up, no capitals and no repeats", () => {
    for (const c of "0Oo1lIi2Zz5Ss8BbgqUuVv") expect(TEMP_PASSWORD_ALPHABET).not.toContain(c);
    expect(TEMP_PASSWORD_ALPHABET).toBe(TEMP_PASSWORD_ALPHABET.toLowerCase());
    expect(new Set(TEMP_PASSWORD_ALPHABET).size).toBe(TEMP_PASSWORD_ALPHABET.length);
  });
});

describe("generateTempPassword", () => {
  it("is 12 characters from the alphabet, with a letter and a digit", () => {
    for (let n = 0; n < 200; n++) {
      const pw = generateTempPassword(realRandom);
      expect(pw).toHaveLength(TEMP_PASSWORD_LENGTH);
      for (const c of pw) expect(TEMP_PASSWORD_ALPHABET).toContain(c);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[a-z]/);
    }
  });

  it("passes the 8-character minimum and differs from one call to the next", () => {
    const a = generateTempPassword(realRandom);
    const b = generateTempPassword(realRandom);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a).not.toBe(b);
  });

  it("throws away bytes that would bias the draw", () => {
    const n = TEMP_PASSWORD_ALPHABET.length;
    // 255 is past the last whole run of the alphabet (256 is not a multiple of it): skipped
    expect(256 % n).toBeGreaterThan(0);
    const pw = generateTempPassword(fixed([255, 0, 255, n - 1]), 4);
    expect(pw).toBe(`${TEMP_PASSWORD_ALPHABET[0]}${TEMP_PASSWORD_ALPHABET[n - 1]}`.repeat(2));
  });

  it("draws again when the result has no digit or no letter", () => {
    const n = TEMP_PASSWORD_ALPHABET.length;
    // the first draw (one 8-byte buffer) is all "a", letters only; the second mixes in a digit
    const pw = generateTempPassword(fixed([0, 0, 0, 0, 0, 0, 0, 0, 0, n - 1, 0, n - 1, 0, n - 1, 0, n - 1]), 4);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).toMatch(/[a-z]/);
  });

  it("honours a custom length", () => {
    expect(generateTempPassword(realRandom, 20)).toHaveLength(20);
  });
});

describe("tempLoginText", () => {
  it("names the user, the password and the sign-in page", () => {
    expect(tempLoginText("somchai", "abc", "https://example.test")).toBe("ชื่อผู้ใช้ somchai · รหัสชั่วคราว abc · เข้าที่ https://example.test/login");
  });
});
