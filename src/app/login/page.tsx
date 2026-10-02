import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { countUsers } from "@/lib/auth/service";
import { getCurrentUser, safeNextPath } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** ?next= is where to go back to after signing in (same-site paths only; anything else is home). */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  if (await getCurrentUser()) redirect("/");
  if ((await countUsers()) === 0) redirect("/setup");
  const { next } = await searchParams;
  return (
    <AuthCard title="เข้าสู่ระบบ" subtitle="สำหรับสมาชิกกิล: ข้อมูลเก็บในบัญชี เปิดเครื่องไหนก็เห็น">
      <LoginForm next={safeNextPath(typeof next === "string" ? next : undefined)} />
    </AuthCard>
  );
}
