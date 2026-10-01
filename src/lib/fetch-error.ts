/**
 * Turns a failed request into words a member can act on: what happened, and what to do next
 * (sign in again, or try the same thing again). Used by every load-error Notice instead of
 * showing "HTTP 401".
 */

/** What went wrong with a request, in short Thai, and the one next step to offer. */
export interface FetchProblem {
  message: string;
  /** "login": the session ended, offer ล็อกอินใหม่ · "retry": trying again may work · null: nothing to press */
  action: "login" | "retry" | null;
  /** the HTTP status, or null when the request never got an answer */
  status: number | null;
}

/** A non-2xx answer. `retryAfterSec` comes from a 429's Retry-After header or its JSON body. */
export class HttpError extends Error {
  readonly status: number;
  readonly retryAfterSec: number | null;
  constructor(status: number, retryAfterSec: number | null = null) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Builds the HttpError for a response that is not ok (reads how long to wait on a 429). */
export async function httpError(res: Response): Promise<HttpError> {
  let wait: number | null = Number(res.headers.get("Retry-After"));
  if (!Number.isFinite(wait) || wait <= 0) {
    wait = null;
    if (res.status === 429) {
      const body = (await res.json().catch(() => null)) as { retryAfterSec?: unknown } | null;
      if (typeof body?.retryAfterSec === "number" && body.retryAfterSec > 0) wait = body.retryAfterSec;
    }
  }
  return new HttpError(res.status, wait);
}

/** fetch() that resolves to the parsed JSON body, and throws HttpError for a non-2xx answer. */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw await httpError(res);
  return (await res.json()) as T;
}

/** True for the error an aborted fetch throws (a newer request replaced it): not a failure to show. */
export function isAbort(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { name?: unknown }).name === "AbortError";
}

export function describeStatus(status: number, retryAfterSec: number | null = null): FetchProblem {
  if (status === 401) return { message: "หมดเวลาเข้าสู่ระบบ", action: "login", status };
  if (status === 403) return { message: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้", action: null, status };
  if (status === 429) {
    const when = retryAfterSec ? `ใน ${Math.max(1, Math.ceil(retryAfterSec / 60))} นาที` : "ในอีกสักครู่";
    return { message: `เพิ่งอัปเดตไป ลองอีกครั้ง${when}`, action: null, status };
  }
  if (status >= 500) return { message: "เซิร์ฟเวอร์ไม่ว่าง ลองใหม่อีกครั้ง", action: "retry", status };
  return { message: `ทำรายการไม่สำเร็จ (รหัส ${status}) ลองใหม่อีกครั้ง`, action: "retry", status };
}

/**
 * Any error from fetch / fetchJson. A failed fetch() (TypeError) means no answer came back at all;
 * a body that is not JSON (SyntaxError) means something between us and the server answered instead.
 */
export function describeError(e: unknown): FetchProblem {
  if (e instanceof HttpError) return describeStatus(e.status, e.retryAfterSec);
  if (e instanceof SyntaxError) return { message: "เซิร์ฟเวอร์ไม่ว่าง ลองใหม่อีกครั้ง", action: "retry", status: null };
  return { message: "ต่ออินเทอร์เน็ตไม่ได้", action: "retry", status: null };
}

/** Same shape as NoticeAction (components/ui/Notice), kept here so lib/ does not import components/. */
export type ProblemAction = { label: string; href: string; route: true } | { label: string; onClick: () => void; disabled?: boolean };

/**
 * The button for a problem's next step: ล็อกอินใหม่ (a client-side link to /login, so this tab's
 * unsaved changes survive the sign-in), or ลองใหม่ calling `retry` (none when no retry function is
 * given). `busy` shows that a retry is already running.
 */
export function problemAction(p: FetchProblem, retry?: () => void, busy = false): ProblemAction | undefined {
  if (p.action === "login") return { label: "ล็อกอินใหม่", href: "/login", route: true };
  if (p.action === "retry" && retry) return { label: busy ? "กำลังโหลด…" : "ลองใหม่", onClick: retry, disabled: busy };
  return undefined;
}
