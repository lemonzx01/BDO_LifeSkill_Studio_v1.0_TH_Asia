/**
 * Temporary passwords an admin hands to a member, and the text that goes with one. Pure: the
 * random source is passed in (crypto.getRandomValues in the browser), so tests can fix it.
 */

/**
 * Letters and digits that cannot be mistaken for one another when read off a phone or typed from
 * a chat message: no 0/o, 1/l/i, 2/z, 5/s, 8/b, g/q (next to 9) or u/v, and no capitals (nothing to mix
 * up by case, nothing that needs shift on a phone keyboard). 21 symbols: 12 of them is ~52 bits.
 */
export const TEMP_PASSWORD_ALPHABET = "acdefhjkmnprtwxy34679";

export const TEMP_PASSWORD_LENGTH = 12;

/** Fills a byte array with random values, e.g. `(b) => crypto.getRandomValues(b)`. */
export type RandomBytes = (buf: Uint8Array) => Uint8Array;

const DIGITS = /[0-9]/;
const LETTERS = /[A-Za-z]/;

/**
 * A random password from TEMP_PASSWORD_ALPHABET with at least one letter and one digit. Each
 * character is drawn without modulo bias (bytes past the last whole run of the alphabet are
 * thrown away and drawn again).
 */
export function generateTempPassword(random: RandomBytes, length = TEMP_PASSWORD_LENGTH): string {
  const n = TEMP_PASSWORD_ALPHABET.length;
  const limit = 256 - (256 % n);
  for (;;) {
    let out = "";
    while (out.length < length) {
      const bytes = random(new Uint8Array(length * 2));
      for (const b of bytes) {
        if (b >= limit) continue;
        out += TEMP_PASSWORD_ALPHABET[b % n];
        if (out.length === length) break;
      }
    }
    // a short password could come out all letters or all digits; draw again (rare at 12)
    if (length < 2 || (DIGITS.test(out) && LETTERS.test(out))) return out;
  }
}

/** What an admin sends a member: who to sign in as, the temporary password and where. */
export function tempLoginText(username: string, password: string, origin: string): string {
  return `ชื่อผู้ใช้ ${username} · รหัสชั่วคราว ${password} · เข้าที่ ${origin}/login`;
}
