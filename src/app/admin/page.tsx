import { AuthCard } from "@/components/auth/AuthCard";
import { AdminUsers } from "@/components/auth/AdminUsers";
import { listUsers } from "@/lib/auth/service";
import { requireAdmin } from "@/lib/auth/session";
import { meta } from "@/lib/data";
import { daysSince } from "@/lib/timing";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireAdmin();
  const dataAgeDays = daysSince(meta.importedAt);
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
    <AuthCard title="จัดการสมาชิก" subtitle="ปิดใช้งานแล้วผู้ใช้จะหลุดจากระบบทันที เปิดกลับได้ภายหลัง ลบคือถาวร" wide>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-panel-2/60 px-3 py-2 text-xs text-muted">
        <span>
          ฐานข้อมูลสูตร: {meta.recipeCount.toLocaleString("th-TH")} สูตร · {meta.itemCount.toLocaleString("th-TH")} ไอเทม · นำเข้าเมื่อ{" "}
          {new Date(meta.importedAt).toLocaleDateString("th-TH", { dateStyle: "medium" })} ({dataAgeDays} วันที่แล้ว
          {dataAgeDays > 60 ? " · เกมอาจมีแพตช์ใหม่ ควรรัน npm run import:data" : ""})
        </span>
        {me.role === "owner" && (
          <a href="/api/admin/backup" className="ml-auto rounded border border-border bg-panel px-2.5 py-1 text-xs text-foreground hover:bg-panel-2" title="ดาวน์โหลดบัญชี ตั้งค่า และคลังของทุกคนเป็นไฟล์เดียว (Supabase ฟรีไม่มี backup อัตโนมัติ)">
            สำรองข้อมูลทั้งหมด
          </a>
        )}
      </div>
      <AdminUsers users={users} meId={me.id} meRole={me.role} />
    </AuthCard>
  );
}
