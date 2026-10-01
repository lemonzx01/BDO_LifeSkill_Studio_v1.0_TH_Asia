import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuth = "ok" | "unconfigured" | "unauthorized";

/**
 * True when the Authorization header is exactly "Bearer <secret>". Both sides are hashed first so
 * timingSafeEqual always compares equal-length buffers and the secret's length does not leak.
 */
export function bearerMatches(header: string | null, secret: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

/**
 * Who may run the scheduled market refresh. A missing CRON_SECRET fails closed ("unconfigured") on
 * Vercel and on any production server (NODE_ENV=production, e.g. `next start` on a VPS or in Docker);
 * only a development run (`next dev`, tests) is allowed without one.
 */
export function checkCronAuth(authorization: string | null, env: Record<string, string | undefined>): CronAuth {
  const secret = env.CRON_SECRET;
  if (!secret) return env.VERCEL || env.NODE_ENV === "production" ? "unconfigured" : "ok";
  return bearerMatches(authorization, secret) ? "ok" : "unauthorized";
}
