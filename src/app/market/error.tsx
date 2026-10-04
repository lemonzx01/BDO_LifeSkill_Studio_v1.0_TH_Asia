"use client";

import Link from "next/link";
import { btn } from "@/components/ui/button";
import { cardCls } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Page, PageHeader } from "@/components/ui/Page";

/**
 * Shown instead of a blank page when the market scan fails on the server; the digest helps find it
 * in the logs. It keeps the page shell (top bar, phone tab bar) so the way on is right there; like
 * the loading skeleton it cannot know who is visiting, so the user menu shows as its placeholder.
 * Its h1 is a PageHeader, as on the 404 page; the card under it says what happened and the way on.
 */
export default function MarketError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page user={null} loading width="narrow">
      <PageHeader eyebrow="ตลาดกลาง Asia" title="หน้าสแกนตลาดโหลดไม่สำเร็จ" />
      <div role="alert" className={`${cardCls()} px-4 py-8 text-center`}>
        <span aria-hidden className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-bad/12 text-bad ring-1 ring-bad/25">
          <Icon name="alert-circle" className="h-5 w-5" />
        </span>
        <p className="mx-auto mt-3 max-w-prose text-sm text-muted">
          server ตอบไม่ทันหรือเกิดข้อผิดพลาด{error.digest ? ` (รหัส ${error.digest})` : ""} ลองใหม่อีกครั้ง ถ้ายังเป็นอยู่ส่งรหัสนี้ให้แอดมิน
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className={btn("primary")}>
            <Icon name="refresh" className="h-4 w-4" />
            ลองใหม่
          </button>
          <Link href="/" className={btn("secondary")}>
            <Icon name="home" className="h-4 w-4" />
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    </Page>
  );
}
