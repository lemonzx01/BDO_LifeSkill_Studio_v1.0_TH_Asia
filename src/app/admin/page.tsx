import Link from "next/link";
import { AdminUsers } from "@/components/auth/AdminUsers";
import { btn } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Page, PageHeader } from "@/components/ui/Page";
import { Stat } from "@/components/ui/Stat";
import { listUsers } from "@/lib/auth/service";
import { requireAdmin } from "@/lib/auth/session";
import { meta } from "@/lib/data";
import { daysSince } from "@/lib/timing";

export const dynamic = "force-dynamic";

/** after this many days the game has likely had a patch the recipe data does not know about */
const STALE_DAYS = 60;

export default async function AdminPage() {
  const me = await requireAdmin();
  const dataAgeDays = daysSince(meta.importedAt);
  const importedOn = new Date(meta.importedAt).toLocaleDateString("th-TH", { dateStyle: "medium" });
  const users = (await listUsers()).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  }));
  return (
    <Page user={{ username: me.username, displayName: me.displayName, role: me.role }} width="narrow">
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="จัดการสมาชิก"
        description="ปิดใช้งานแล้วผู้ใช้จะหลุดจากระบบทันที เปิดกลับได้ภายหลัง ลบคือถาวร"
        actions={
          <Link href="/admin/stats" className={btn("secondary")}>
            <Icon name="chart-bar" className="h-4 w-4" />
            สถิติการใช้งาน
          </Link>
        }
      />
      <div className="space-y-4 md:space-y-6">
        {/* old recipe data is the one system fact that needs doing something, so it comes first */}
        {dataAgeDays > STALE_DAYS && (
          <Notice tone="warn">
            ฐานข้อมูลสูตรนำเข้าเมื่อ {importedOn} ({dataAgeDays} วันที่แล้ว) · เกมอาจมีแพตช์ใหม่ ควรรัน npm run import:data
          </Notice>
        )}

        <AdminUsers users={users} meId={me.id} meRole={me.role} />

        {/* housekeeping, below the members: the game data the tools run on and (แอดมินใหญ่) the backup */}
        <Card>
          <CardHeader icon="layers" title="ข้อมูลระบบ" />
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            <Stat label="สูตร" value={meta.recipeCount.toLocaleString("th-TH")} />
            <Stat label="ไอเทม" value={meta.itemCount.toLocaleString("th-TH")} />
            {/* a phone has two columns: this third tile takes the whole second row instead of half of it */}
            <Stat label="นำเข้าข้อมูลเกม" value={importedOn} hint={`${dataAgeDays} วันที่แล้ว`} className="col-span-2 sm:col-span-1" />
          </div>
          {me.role === "owner" && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-4 py-3">
              <p className="min-w-0 flex-1 basis-64 text-sm text-muted">
                สำรองบัญชี ตั้งค่า และคลังของทุกคนเป็นไฟล์เดียว (Supabase ฟรีไม่มี backup อัตโนมัติ)
              </p>
              {/* a plain <a>, not <Link>: an API route that downloads a file must not be prefetched */}
              <a
                href="/api/admin/backup"
                title="ดาวน์โหลดบัญชี ตั้งค่า และคลังของทุกคนเป็นไฟล์เดียว (Supabase ฟรีไม่มี backup อัตโนมัติ)"
                className={btn("secondary", "sm")}
              >
                <Icon name="download" className="h-4 w-4" />
                สำรองข้อมูลทั้งหมด
              </a>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
