/** Helpers for /api/health: what the public may see of a database failure, and the admin-only details. */

/** Anything that looks like credentials inside a connection string is masked before it leaves the server. */
export function sanitize(message: string): string {
  return message
    .replace(/\/\/[^@\s]*@/g, "//***@")
    .replace(/^Failed query: [\s\S]*$/, "Failed query (see cause)")
    .slice(0, 300);
}

export interface ErrorLink {
  code: string | null;
  message: string;
}

/** The error plus its `cause` chain, innermost last — Drizzle wraps driver errors, and the driver error is the useful one. */
export function describeError(e: unknown): ErrorLink[] {
  const chain: ErrorLink[] = [];
  let cur: unknown = e;
  for (let depth = 0; cur && depth < 4; depth++) {
    const err = cur as { code?: unknown; message?: unknown; cause?: unknown };
    chain.push({ code: typeof err.code === "string" ? err.code : null, message: sanitize(String(err.message ?? cur)) });
    cur = err.cause;
  }
  return chain;
}

/**
 * The innermost error code (Postgres SQLSTATE such as "28P01", or a Node code such as "ECONNREFUSED"),
 * safe to show anyone: only short upper-case codes pass, never a message.
 */
export function publicErrorCode(chain: ErrorLink[]): string | null {
  for (let i = chain.length - 1; i >= 0; i--) {
    const code = chain[i].code;
    if (code && /^[A-Z0-9_]{1,32}$/.test(code)) return code;
  }
  return null;
}

export function driverName(env: Record<string, string | undefined>): string {
  const url = env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL || "";
  if (!url) return "pglite (embedded)";
  return /\.neon\.tech[/:]/.test(url) ? "neon-http" : "postgres.js";
}
