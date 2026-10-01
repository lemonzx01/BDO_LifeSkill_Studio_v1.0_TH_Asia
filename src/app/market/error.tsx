"use client";

import Link from "next/link";
import { btn } from "@/components/ui/button";
import { Notice } from "@/components/ui/Notice";

/** Shown instead of a blank page when the market scan fails on the server; the digest helps find it in the logs. */
export default function MarketError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-10 md:px-6">
      <Notice tone="bad">
        <h1 className="mb-1 font-semibold">หน้าสแกนตลาดโหลดไม่สำเร็จ</h1>
        <p className="text-muted">
          server ตอบไม่ทันหรือเกิดข้อผิดพลาด{error.digest ? ` (รหัส ${error.digest})` : ""} ลองใหม่อีกครั้ง ถ้ายังเป็นอยู่ส่งรหัสนี้ให้แอดมิน
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={reset} className={btn("primary")}>
            ลองใหม่
          </button>
          <Link href="/" className={btn("secondary")}>
            กลับหน้าแรก
          </Link>
        </div>
      </Notice>
    </main>
  );
}
