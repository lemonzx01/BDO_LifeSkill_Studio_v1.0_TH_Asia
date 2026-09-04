/**
 * Account recovery from the command line, for when nobody can log in as แอดมินใหญ่.
 * Talks to the same Postgres the web uses (DATABASE_URL, e.g. from .env.local).
 *
 *   node --env-file=.env.local scripts/admin-tools.mjs list
 *   node --env-file=.env.local scripts/admin-tools.mjs transfer-owner <username>     # that account becomes the only แอดมินใหญ่, other owners become แอดมินเล็ก
 *   node --env-file=.env.local scripts/admin-tools.mjs set-role <username> <owner|admin|member>
 *   node --env-file=.env.local scripts/admin-tools.mjs reset-password <username> <new-password>   # temporary: the user must change it at next login
 */
import bcrypt from "bcryptjs";
import postgres from "postgres";

const [cmd, username, value] = process.argv.slice(2);
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set (run with: node --env-file=.env.local scripts/admin-tools.mjs …)");
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : "require", onnotice: () => {} });

const ROLE_TH = { owner: "แอดมินใหญ่", admin: "แอดมินเล็ก", member: "สมาชิก" };

async function list() {
  const rows = await sql`select id, username, display_name, role, is_active, must_change_password from users order by id`;
  for (const r of rows) {
    console.log(`${String(r.id).padStart(3)}  ${r.username.padEnd(20)} ${(r.display_name ?? "").padEnd(16)} ${ROLE_TH[r.role] ?? r.role}${r.is_active ? "" : "  (ปิดใช้งาน)"}${r.must_change_password ? "  (รอตั้งรหัสใหม่)" : ""}`);
  }
}

async function findUser(name) {
  const [u] = await sql`select id, username, role, is_active from users where username = ${String(name).trim().toLowerCase()}`;
  if (!u) throw new Error(`ไม่พบผู้ใช้ ${name}`);
  return u;
}

async function assertOwnerRemains(exceptId) {
  const [{ n }] = await sql`select count(*)::int as n from users where role = 'owner' and is_active = true and id <> ${exceptId}`;
  if (n === 0) throw new Error("ต้องเหลือแอดมินใหญ่ที่เปิดใช้งานอย่างน้อย 1 คน");
}

async function main() {
  if (cmd === "list") return list();
  if (!username) throw new Error("ต้องระบุชื่อผู้ใช้");
  const user = await findUser(username);

  if (cmd === "transfer-owner") {
    if (!user.is_active) throw new Error("บัญชีนี้ถูกปิดใช้งานอยู่");
    await sql.begin(async (tx) => {
      await tx`update users set role = 'admin' where role = 'owner' and id <> ${user.id}`;
      await tx`update users set role = 'owner' where id = ${user.id}`;
    });
    console.log(`${user.username} เป็นแอดมินใหญ่คนเดียวแล้ว (แอดมินใหญ่คนอื่นกลายเป็นแอดมินเล็ก)`);
  } else if (cmd === "set-role") {
    if (!["owner", "admin", "member"].includes(value)) throw new Error("ระดับต้องเป็น owner, admin หรือ member");
    if (user.role === "owner" && value !== "owner") await assertOwnerRemains(user.id);
    await sql`update users set role = ${value} where id = ${user.id}`;
    console.log(`${user.username} -> ${ROLE_TH[value]}`);
  } else if (cmd === "reset-password") {
    if (!value || value.length < 8) throw new Error("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว");
    const hash = await bcrypt.hash(value, 10);
    await sql.begin(async (tx) => {
      await tx`update users set password_hash = ${hash}, must_change_password = true where id = ${user.id}`;
      await tx`delete from sessions where user_id = ${user.id}`;
    });
    console.log(`ตั้งรหัสชั่วคราวให้ ${user.username} แล้ว ล็อกอินแล้วระบบจะให้ตั้งรหัสใหม่`);
  } else {
    throw new Error("คำสั่งที่ใช้ได้: list, transfer-owner, set-role, reset-password");
  }
  await list();
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 1 }));
