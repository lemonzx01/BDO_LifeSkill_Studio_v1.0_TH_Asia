import { AuthCard } from "@/components/auth/AuthCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
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
      <ChangePasswordForm />
    </AuthCard>
  );
}
