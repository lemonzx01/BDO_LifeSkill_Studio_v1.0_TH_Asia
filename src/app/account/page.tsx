import { AuthCard } from "@/components/auth/AuthCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ChangeProfileForm } from "@/components/auth/ChangeProfileForm";
import { ghostBtn } from "@/components/auth/ui";
import { SectionLabel } from "@/components/ui/Card";
import { logoutEverywhereAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  // the one page open while the temporary password from the admin is still pending
  const user = await requireUser({ allowPendingPassword: true });
  const { first } = await searchParams;
  const forced = first === "1" || user.mustChangePassword;
  return (
    <AuthCard
      title={`บัญชีของ ${user.displayName}`}
      subtitle={forced ? "นี่คือรหัสผ่านชั่วคราวจากแอดมิน กรุณาตั้งรหัสผ่านใหม่ของคุณเองก่อนใช้งาน" : `@${user.username}`}
    >
      <section>
        <SectionLabel as="h2" className="mb-2">
          รหัสผ่าน
        </SectionLabel>
        <ChangePasswordForm />
      </section>
      {!forced && (
        <section className="mt-6 border-t border-border pt-4">
          <SectionLabel as="h2" className="mb-2">
            ชื่อผู้ใช้และชื่อที่แสดง
          </SectionLabel>
          <ChangeProfileForm username={user.username} displayName={user.displayName} />
        </section>
      )}
      <section className="mt-6 border-t border-border pt-4">
        <SectionLabel as="h2" className="mb-2">
          อุปกรณ์ที่ล็อกอินไว้
        </SectionLabel>
        <p className="mb-3 text-xs text-muted">ลืมออกจากระบบที่เครื่องอื่น? กดปุ่มนี้เพื่อออกจากทุกเครื่อง รวมถึงเครื่องนี้</p>
        <form action={logoutEverywhereAction}>
          <button type="submit" className={ghostBtn}>
            ออกจากระบบทุกเครื่อง
          </button>
        </form>
      </section>
    </AuthCard>
  );
}
