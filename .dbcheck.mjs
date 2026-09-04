const u = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!u) { console.log("NO DATABASE_URL in .env.local"); process.exit(0); }
const host = u.replace(/^[^@]*@/, "").replace(/[/?].*$/, "");
const user = u.replace(/^postgres(ql)?:\/\//, "").replace(/:.*$/, "");
const pwLen = (u.match(/^[^:]+:\/\/[^:]+:([^@]*)@/) || [,""])[1].length;
console.log("host:", host, "| user:", user, "| password length:", pwLen, "| placeholder left:", /\[YOUR-PASSWORD\]/.test(u));
const { default: postgres } = await import("postgres");
const sql = postgres(u, { prepare: false, ssl: "require", connect_timeout: 15, max: 1 });
try { const r = await sql`select version()`; console.log("OK:", r[0].version.slice(0, 60)); }
catch (e) { console.log("FAIL:", e.code, String(e.message).replace(/:[^:@]*@/, ":***@")); }
finally { await sql.end(); }
