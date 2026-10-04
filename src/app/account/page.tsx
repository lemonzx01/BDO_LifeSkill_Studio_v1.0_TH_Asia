import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ChangeProfileForm } from "@/components/auth/ChangeProfileForm";
import { LogoutEverywhereForm } from "@/components/auth/LogoutEverywhereForm";
import { Card, CardHeader, SectionLabel } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Page, PageHeader } from "@/components/ui/Page";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const LOGOUT_EVERYWHERE_HINT = "ลืมออกจากระบบที่เครื่องอื่น? กดปุ่มนี้เพื่อออกจากทุกเครื่อง รวมถึงเครื่องนี้";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  // the one page open while the temporary password from the admin is still pending
  const user = await requireUser({ allowPendingPassword: true });
  const { first } = await searchParams;
  // only a pending temporary password forces the change; an old ?first=1 (Back after the change, a
  // bookmark) just tidies the address
  const forced = user.mustChangePassword;
  if (first === "1" && !forced) redirect("/account");

  // forced change: a focused card with no app navigation, since every other page sends the member
  // back here until the new password is set. The new password is the card's one big action; signing
  // out everywhere waits quietly under a hairline
  if (forced) {
    return (
      <AuthCard title={`บัญชีของ ${user.displayName}`} subtitle="นี่คือรหัสผ่านชั่วคราวจากแอดมิน กรุณาตั้งรหัสผ่านใหม่ของคุณเองก่อนใช้งาน">
        <section>
          <SectionLabel as="h2" className="mb-3">
            รหัสผ่าน
          </SectionLabel>
          <ChangePasswordForm wide />
        </section>
        <section className="mt-6 border-t border-border pt-5">
          <SectionLabel as="h2">อุปกรณ์ที่ล็อกอินไว้</SectionLabel>
          <p className="mb-3 mt-1 text-xs text-muted">{LOGOUT_EVERYWHERE_HINT}</p>
          <LogoutEverywhereForm />
        </section>
      </AuthCard>
    );
  }

  // the two things a member comes here to change sit side by side (stacked on phones); signing out
  // everywhere is a single action, so it is one row under them: its words left, its button right
  return (
    <Page user={{ username: user.username, displayName: user.displayName, role: user.role }} width="narrow">
      <PageHeader title="บัญชีของฉัน" description={`${user.displayName} · @${user.username}`} />
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <Card>
          <CardHeader icon="key" title="รหัสผ่าน" />
          <div className="p-4">
            <ChangePasswordForm />
          </div>
        </Card>
        <Card>
          <CardHeader icon="user" title="ชื่อผู้ใช้และชื่อที่แสดง" />
          <div className="p-4">
            <ChangeProfileForm username={user.username} displayName={user.displayName} />
          </div>
        </Card>
        <Card className="md:col-span-2">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 items-start gap-2.5">
              <Icon name="lock" className="mt-0.5 h-5 w-5 text-muted" />
              <div className="min-w-0">
                <h2 className="font-display text-title font-semibold text-balance text-foreground">อุปกรณ์ที่ล็อกอินไว้</h2>
                <p className="mt-0.5 text-xs text-muted">{LOGOUT_EVERYWHERE_HINT}</p>
              </div>
            </div>
            <LogoutEverywhereForm />
          </div>
        </Card>
      </div>
    </Page>
  );
}
