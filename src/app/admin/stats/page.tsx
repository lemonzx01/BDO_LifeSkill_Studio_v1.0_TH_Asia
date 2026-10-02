import Link from "next/link";
import { UsageOverview } from "@/components/admin/UsageOverview";
import { btn } from "@/components/ui/button";
import { Notice } from "@/components/ui/Notice";
import { Page, PageHeader } from "@/components/ui/Page";
import { requireAdmin } from "@/lib/auth/session";
import { dayLabel } from "@/lib/usage/format";
import { getUsageStats, type UsageStats } from "@/lib/usage/stats";
import { bangkokToday } from "@/lib/usage/track";

export const dynamic = "force-dynamic";

/** How many people use the site: for admins, and laid out to screenshot for a portfolio. */
export default async function UsageStatsPage() {
  const me = await requireAdmin();
  const today = bangkokToday();
  let stats: UsageStats | null = null;
  try {
    stats = await getUsageStats(today);
  } catch (e) {
    console.error("usage stats failed:", (e as Error).message);
  }
  return (
    <Page user={{ username: me.username, displayName: me.displayName, role: me.role }} width="narrow">
      <PageHeader
        title="สถิติการใช้งาน"
        description="มีคนเข้ามาใช้เว็บนี้กี่คน นับทั้งสมาชิกและผู้เยี่ยมชม"
        meta={[`ข้อมูลถึง ${dayLabel(today, true)} (เวลาไทย)`, stats?.firstDay && `เริ่มนับ ${dayLabel(stats.firstDay, true)}`]}
        actions={
          <Link href="/admin" className={btn("secondary")}>
            ← จัดการสมาชิก
          </Link>
        }
      />
      {stats ? (
        <UsageOverview stats={stats} />
      ) : (
        <Notice tone="bad" action={{ label: "ลองอีกครั้ง", href: "/admin/stats", route: true }}>
          โหลดสถิติไม่สำเร็จ ลองใหม่อีกครั้ง
        </Notice>
      )}
    </Page>
  );
}
