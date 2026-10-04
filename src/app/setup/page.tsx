import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetupForm } from "@/components/auth/SetupForm";
import { countUsers } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** Shown once, while there are no accounts at all. */
export default async function SetupPage() {
  if ((await countUsers()) > 0) redirect("/login");
  return (
    <AuthCard eyebrow="ตั้งค่าครั้งแรก" title="สร้างบัญชีแอดมิน" subtitle="บัญชีนี้จะใช้สร้างและจัดการบัญชีของสมาชิกในกิล">
      <SetupForm />
    </AuthCard>
  );
}
