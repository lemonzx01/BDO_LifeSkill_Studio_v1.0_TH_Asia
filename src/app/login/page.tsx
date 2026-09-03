import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { countUsers } from "@/lib/auth/service";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  if ((await countUsers()) === 0) redirect("/setup");
  return (
    <AuthCard title="เข้าสู่ระบบ" subtitle="เครื่องมือคำนวณ Life Skill สำหรับสมาชิกกิล">
      <LoginForm />
    </AuthCard>
  );
}
