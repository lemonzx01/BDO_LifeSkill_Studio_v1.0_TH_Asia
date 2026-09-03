import bcrypt from "bcryptjs";

const ROUNDS = 10;

/** Real bcrypt hash compared against when a username does not exist, so timing looks the same. */
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", ROUNDS);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร";
  if (password.length > 128) return "รหัสผ่านยาวเกินไป";
  return null;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 _ . - ยาว 3–32 ตัว";
  return null;
}
