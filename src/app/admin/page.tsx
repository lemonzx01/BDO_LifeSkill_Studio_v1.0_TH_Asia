import { AuthCard } from "@/components/auth/AuthCard";
import { AdminUsers } from "@/components/auth/AdminUsers";
import { listUsers } from "@/lib/auth/service";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireAdmin();
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
      <AdminUsers users={users} meId={me.id} meRole={me.role} />
    </AuthCard>
  );
}
