import { describe, expect, it } from "vitest";
import { describeError, describeStatus, HttpError, httpError, isAbort, problemAction } from "./fetch-error";

describe("describeStatus", () => {
  it("401 says the session ended and offers to sign in again", () => {
    const p = describeStatus(401);
    expect(p).toMatchObject({ message: "หมดเวลาเข้าสู่ระบบ", action: "login" });
    expect(problemAction(p, () => {})).toEqual({ label: "ล็อกอินใหม่", href: "/login", route: true });
  });

  it("429 says how many minutes to wait, rounded up, and offers no button", () => {
    expect(describeStatus(429, 45).message).toBe("เพิ่งอัปเดตไป ลองอีกครั้งใน 1 นาที");
    expect(describeStatus(429, 61).message).toBe("เพิ่งอัปเดตไป ลองอีกครั้งใน 2 นาที");
    expect(describeStatus(429).message).toBe("เพิ่งอัปเดตไป ลองอีกครั้งในอีกสักครู่");
    expect(problemAction(describeStatus(429, 30), () => {})).toBeUndefined();
  });

  it("5xx asks to try again, with a retry button when there is something to retry", () => {
    const p = describeStatus(502);
    expect(p).toMatchObject({ message: "เซิร์ฟเวอร์ไม่ว่าง ลองใหม่อีกครั้ง", action: "retry" });
    expect(problemAction(p)).toBeUndefined();
    const retry = () => {};
    expect(problemAction(p, retry)).toEqual({ label: "ลองใหม่", onClick: retry, disabled: false });
    expect(problemAction(p, retry, true)).toMatchObject({ label: "กำลังโหลด…", disabled: true });
  });
});

describe("describeError", () => {
  it("reads HttpError, a failed fetch and a body that is not JSON", () => {
    expect(describeError(new HttpError(401)).action).toBe("login");
    expect(describeError(new TypeError("Failed to fetch"))).toMatchObject({ message: "ต่ออินเทอร์เน็ตไม่ได้", status: null });
    expect(describeError(new SyntaxError("Unexpected token <")).message).toBe("เซิร์ฟเวอร์ไม่ว่าง ลองใหม่อีกครั้ง");
  });

  it("takes the wait from Retry-After, else from a 429's JSON body", async () => {
    const withHeader = await httpError(new Response("{}", { status: 429, headers: { "Retry-After": "90" } }));
    expect(withHeader.retryAfterSec).toBe(90);
    const withBody = await httpError(new Response(JSON.stringify({ retryAfterSec: 30 }), { status: 429 }));
    expect(withBody.retryAfterSec).toBe(30);
    expect((await httpError(new Response("", { status: 500 }))).retryAfterSec).toBeNull();
  });

  it("knows an aborted request is not a failure", () => {
    expect(isAbort(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isAbort(new TypeError("Failed to fetch"))).toBe(false);
  });
});
