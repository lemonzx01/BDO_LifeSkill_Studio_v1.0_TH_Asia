import { AuthCard } from "@/components/auth/AuthCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ChangeProfileForm } from "@/components/auth/ChangeProfileForm";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const user = await requireUser();
  const { first } = await searchParams;
  const forced = first === "1" || user.mustChangePassword;
  return (
    <AuthCard
      title={`บัญชีของ ${user.displayName}`}
      subtitle={forced ? "นี่คือรหัสผ่านชั่วคราวจากแอดมิน กรุณาตั้งรหัสผ่านใหม่ของคุณเองก่อนใช้งาน" : `@${user.username}`}
    >
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">รหัสผ่าน</h2>
        <ChangePasswordForm />
      </section>
      {!forced && (
        <section className="mt-6 border-t border-border pt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">ชื่อผู้ใช้และชื่อที่แสดง</h2>
          <ChangeProfileForm username={user.username} displayName={user.displayName} />
        </section>
      )}
    </AuthCard>
  );
}
