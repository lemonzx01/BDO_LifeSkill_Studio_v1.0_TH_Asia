import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { WithTip } from "@/components/ui/InfoTip";
import { Notice } from "@/components/ui/Notice";
import { Stat } from "@/components/ui/Stat";
import { count, dayLabel, decimal, share } from "@/lib/usage/format";
import type { UsageStats } from "@/lib/usage/stats";
import { NEW_VISITORS_PER_ADDRESS_PER_DAY, NEW_VISITORS_PER_DAY, PATH_LABEL } from "@/lib/usage/track";
import { UsageChart } from "./UsageChart";

/** "12 คน": the number in the tile's type, the unit small and grey */
function People({ n, unit = "คน", average = false }: { n: number; unit?: string; average?: boolean }) {
  return (
    <>
      {average ? decimal(n) : count(n)} <span className="text-xs font-normal text-muted">{unit}</span>
    </>
  );
}

/**
 * One whole split in two (new / returning, members / guests): a bar with a 2px gap between the
 * parts and a key under it that names each part with its number, so the split never rests on
 * colour alone.
 */
function Split({ title, a, b }: { title: ReactNode; a: { label: ReactNode; n: number }; b: { label: ReactNode; n: number } }) {
  const total = a.n + b.n;
  const aPct = total > 0 ? (a.n / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted">{title}</div>
      <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded bg-panel-2">
        {a.n > 0 && <div className="h-full rounded-sm bg-accent" style={{ width: `${aPct}%` }} />}
        {b.n > 0 && <div className="h-full flex-1 rounded-sm bg-info" />}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />
          {a.label} <span className="num font-semibold">{count(a.n)}</span> <span className="text-xs text-muted">({share(a.n, total)})</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-info" />
          {b.label} <span className="num font-semibold">{count(b.n)}</span> <span className="text-xs text-muted">({share(b.n, total)})</span>
        </li>
      </ul>
    </div>
  );
}

/** Everything on /admin/stats below the page header. */
export function UsageOverview({ stats: s }: { stats: UsageStats }) {
  const topViews = s.topPages[0]?.views ?? 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="ผู้ใช้วันนี้" value={<People n={s.visitorsToday} />} />
        <Stat label="7 วันล่าสุด" value={<People n={s.visitors7d} />} />
        <Stat label="30 วันล่าสุด" value={<People n={s.visitors30d} />} emphasis />
        <Stat
          label={s.firstDay ? `ทั้งหมด (ตั้งแต่ ${dayLabel(s.firstDay, true)})` : "ทั้งหมด"}
          value={<People n={s.visitorsAllTime} />}
        />
      </div>

      {s.cappedDays30.length > 0 && (
        <Notice tone="warn" className="mt-4">
          บางส่วนไม่ถูกนับ: {s.cappedDays30.length} วันใน 30 วันนี้ (ล่าสุด {dayLabel(s.cappedDays30[0], true)}) มีคนใหม่จากเครือข่ายเดียวกันเกินเพดานกันปั่นยอด
          ตัวเลขคนของวันนั้นจึงอาจขาดไปบ้าง
        </Notice>
      )}

      {s.visitorsAllTime === 0 && s.pageViews30d === 0 ? (
        <Card className="mt-4">
          <EmptyState title="ยังไม่มีข้อมูล" hint="เริ่มนับตั้งแต่ตอนนี้ มีคนเปิดเว็บเมื่อไรตัวเลขจะขึ้นที่นี่" />
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <CardHeader title="30 วันล่าสุด" hint={`${dayLabel(s.daily[s.daily.length - 30]?.day ?? s.today)} – ${dayLabel(s.today, true)}`} />
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <Split
                title="คนใหม่ / กลับมาใช้อีก"
                a={{ label: <WithTip label="คนใหม่" tip="เข้ามาครั้งแรกในช่วง 30 วันนี้" />, n: s.new30d }}
                b={{ label: <WithTip label="กลับมาใช้อีก" tip="เคยเข้ามาก่อนช่วง 30 วันนี้ แล้วกลับมาใช้อีก" />, n: s.returning30d }}
              />
              <Split
                title="สมาชิก / ผู้เยี่ยมชม"
                a={{ label: <WithTip label="สมาชิก" tip="ล็อกอินอยู่ตอนเข้าใช้อย่างน้อย 1 วัน" />, n: s.members30d }}
                b={{ label: <WithTip label="ผู้เยี่ยมชม" tip="เข้าใช้โดยไม่ได้ล็อกอิน" />, n: s.guests30d }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:grid-cols-3">
              <Stat label="เปิดหน้าเว็บ" value={<People n={s.pageViews30d} unit="ครั้ง" />} />
              <Stat
                label="เฉลี่ยต่อคน"
                value={<People n={s.visitors30d > 0 ? s.pageViews30d / s.visitors30d : 0} unit="หน้า" average />}
              />
              {/* a phone has two columns: this third tile takes the whole second row instead of half of it */}
              <div className="col-span-2 sm:col-span-1">
                <Stat
                  label={<WithTip label="ใช้มากกว่า 1 วัน" tip="เข้ามาใช้ 2 วันขึ้นไปในช่วง 30 วันนี้" />}
                  value={
                    <>
                      <People n={s.repeat30d} /> <span className="text-xs font-normal text-muted">({share(s.repeat30d, s.visitors30d)})</span>
                    </>
                  }
                />
              </div>
            </div>
          </Card>

          <UsageChart daily={s.daily} today={s.today} />

          <Card className="mt-4">
            <CardHeader title="หน้าที่เปิดบ่อย" hint="จำนวนครั้งที่เปิดแต่ละหน้า 30 วันล่าสุด" />
            {s.topPages.length === 0 ? (
              <EmptyState title="ยังไม่มีการเปิดหน้าใน 30 วันนี้" />
            ) : (
              <ol className="divide-y divide-border">
                {s.topPages.map((p) => (
                  <li key={p.path} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {PATH_LABEL[p.path]}
                        {p.path !== "other" && <span className="ml-1.5 text-xs text-muted">{p.path}</span>}
                      </span>
                      <span className="shrink-0">
                        <span className="num font-semibold">{count(p.views)}</span>{" "}
                        <span className="text-xs text-muted">ครั้ง · {share(p.views, s.pageViews30d)}</span>
                      </span>
                    </div>
                    <div aria-hidden className="mt-1.5 h-1.5 rounded-sm bg-panel-2">
                      <div className="h-full rounded-sm bg-accent/70" style={{ width: `${topViews > 0 ? Math.max(1, (p.views / topViews) * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
      )}

      <Notice tone="info" className="mt-4">
        <p>นับแบบไม่ระบุตัวตน สถิติไม่เก็บ IP หรือชื่อผู้ใช้ (IP ใช้กันสแปมชั่วคราวแล้วลบ) · 1 เบราว์เซอร์ = 1 คน</p>
        <p className="mt-1 text-xs">
          ไม่นับบอท และเบราว์เซอร์ที่ตั้งไม่ให้ติดตาม (Do Not Track / GPC) · กันปั่นยอด: 1 เครือข่ายเพิ่มคนใหม่ได้ไม่เกิน {NEW_VISITORS_PER_ADDRESS_PER_DAY} คนต่อวัน
          ทั้งเว็บไม่เกิน {count(NEW_VISITORS_PER_DAY)} คนต่อวัน · นับวันตามเวลาไทย
        </p>
      </Notice>
    </>
  );
}
