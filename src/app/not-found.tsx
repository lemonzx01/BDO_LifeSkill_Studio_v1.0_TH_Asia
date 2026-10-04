import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Page, PageHeader } from "@/components/ui/Page";
import { getOptionalUser } from "@/lib/auth/session";

/**
 * The 404: any URL the app does not have, and every notFound(). It keeps the whole page shell (top
 * bar, phone tab bar), so the way on is right there; the card offers the home page.
 */
export default async function NotFound() {
  const user = await getOptionalUser();
  return (
    <Page user={user && { username: user.username, displayName: user.displayName, role: user.role }} width="narrow">
      <PageHeader eyebrow="404" title="ไม่พบหน้านี้" description="ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว" />
      <Card>
        <EmptyState
          icon="book"
          title="หน้านี้ไม่มีในสมุดของเรา"
          hint="กลับไปเริ่มที่หน้าแรก หรือเลือกหน้าที่ต้องการจากเมนู"
          action={{ label: "กลับหน้าแรก", href: "/" }}
        />
      </Card>
    </Page>
  );
}
