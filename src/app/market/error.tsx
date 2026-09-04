"use client";

import Link from "next/link";

/** Shown instead of a blank page when the market scan fails on the server; the digest helps find it in the logs. */
export default function MarketError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-10 md:px-6">
      <div className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm">
        <h1 className="mb-1 font-semibold text-bad">หน้าสแกนตลาดโหลดไม่สำเร็จ</h1>
        <p className="text-muted">
          server ตอบไม่ทันหรือเกิดข้อผิดพลาด{error.digest ? ` (รหัส ${error.digest})` : ""} ลองใหม่อีกครั้ง ถ้ายังเป็นอยู่ส่งรหัสนี้ให้แอดมิน
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={reset} className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-black hover:opacity-90">
            ลองใหม่
          </button>
          <Link href="/" className="rounded border border-border bg-panel px-3 py-1.5 text-sm hover:bg-panel-2">
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    </main>
  );
}
