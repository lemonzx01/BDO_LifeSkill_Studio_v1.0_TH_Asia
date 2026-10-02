import Link from "next/link";
import { btn } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Page, PageHeader } from "@/components/ui/Page";
import { getOptionalUser } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/brand";
import { HOME_PICKS_TITLE } from "@/lib/home-picks";
import { IMPORT_MODE_LABEL } from "@/lib/inventory-import";
import { SIGNAL_NAME } from "@/lib/market/signals";
import { INVENTORY_SORT_LABEL, NET, OWNED_COST, OWNED_COST_LABEL, SETTINGS_TITLE } from "@/lib/settings-labels";

export const dynamic = "force-dynamic";

const SECTIONS: { href: string; title: string; lines: string[] }[] = [
  {
    href: "/",
    title: "หน้าแรก",
    lines: [
      `ตั้งค่า Mastery แปรธาตุ/ทำอาหาร/แปรรูป และ Value Pack ครั้งแรกให้ตรงกับตัวละคร ตัวเลขทุกหน้าจะคิดจากค่านี้ แก้ทีหลังได้ที่ปุ่ม "${SETTINGS_TITLE}"`,
      `การ์ด "${HOME_PICKS_TITLE}" ด้านบนคือ 3 สูตรกำไรดีสุดจากทุกสาย (ไม่รวมกล่องราชวัง) เรียงตามกำไร/ชิ้น หรือกำไร/ชม. (ค่าเดียวกับหน้าคำนวณสูตร) ใต้ลงมาเป็นการ์ดของแต่ละสาย และของที่ตลาดกำลังขาด`,
      "ถ้าใส่ของในคลังไว้ จะมีกล่อง \"ทำอะไรได้จากของในคลัง\" บอกว่าของที่มีทำอะไรแล้วได้เงินมากที่สุด",
    ],
  },
  {
    href: "/recipes",
    title: "คำนวณสูตร",
    lines: [
      "แท็บด้านบนเลือกสาย (แปรธาตุ / ทำอาหาร / แปรรูป / ราชวัง) เรียงตามกำไรต่อชิ้น ROI หรือกำไรต่อชั่วโมง",
      "กดแถวเพื่อดูวัตถุดิบเป็นชั้น ๆ ราคาที่ใช้คิด และสูตรทางเลือกอื่นของสินค้าเดียวกัน",
      "แผนผลิตด้านล่าง: ใส่จำนวนที่อยากได้ ระบบบอกว่าต้องซื้ออะไรเพิ่ม ใช้ของในคลังที่มีอยู่แล้วหักให้ พอผลิตจริงกด \"ผลิตแล้ว\" จะหักวัตถุดิบและเพิ่มผลผลิตเข้าคลัง",
      `"ตั้งค่า" ในหน้านี้ หรือปุ่มตั้งค่า (รูปเฟือง) มุมขวาบน ใช้ได้ทุกหน้า (ถ้าล็อกอินอยู่จะอยู่ในเมนูชื่อของคุณ): Mastery, Value Pack, แหวนพ่อค้า, รอบต่อชั่วโมง และ${OWNED_COST}: "${OWNED_COST_LABEL.market}", "${OWNED_COST_LABEL.avg}" หรือ "${OWNED_COST_LABEL.zero}"`,
    ],
  },
  {
    href: "/market",
    title: "สแกนตลาด",
    lines: [
      `"แนะนำวันนี้" 3 กล่อง: ${SIGNAL_NAME.trade.name} (ซื้อตอนนี้ขายราคาปกติยังกำไร), ${SIGNAL_NAME.buy.name} (ถูกกว่าปกติและมีหลักฐานว่าจะฟื้น), ${SIGNAL_NAME.sell.name} (แพงกว่าปกติ)`,
      "กดแถวเพื่อดูหลักฐาน: ราคาเทียบ 90 วัน ของค้างขายหมดในกี่วัน แนวโน้ม 7 วัน และราคาย้อนหลัง",
      "ระบบมองแค่ราคาและปริมาณซื้อขาย ไม่รู้อีเวนต์หรือของแจกล่วงหน้า ใช้เป็นข้อมูลประกอบ ไม่ใช่คำทำนาย",
      "แสดงเฉพาะไอเทมที่มีการซื้อขายใน 14 วัน ราคาอัปเดตทุกราว 15 นาทีเมื่อมีคนเปิดเว็บ (สมาชิกกดอัปเดตเองได้)",
    ],
  },
  {
    href: "/inventory",
    title: "คลังของ",
    lines: [
      `พิมพ์ชื่อไอเทมเพื่อเพิ่ม แถวใหม่จะถูกเลื่อนมาให้เห็นและไฮไลต์ ค้นหาในคลังหรือเรียงตาม${Object.values(INVENTORY_SORT_LABEL).join(" / ")}ได้`,
      `ต้นทุนต่อชิ้น: "ตามตลาด" ใช้ราคาปัจจุบันเสมอ หรือ "กำหนดเอง" ใส่ราคาที่จ่ายจริง ซึ่งใช้คิดกำไรเมื่อตั้ง "${OWNED_COST}" เป็น "${OWNED_COST_LABEL.avg}" ใน${SETTINGS_TITLE}`,
      `นำเข้า CSV: กด "นำเข้า / ส่งออก" แล้วเลือก "${IMPORT_MODE_LABEL.replace}" เมื่อนำเข้าไฟล์เดิมซ้ำ หรือ "${IMPORT_MODE_LABEL.add}" เมื่อทำ CSV ทีละคลังในเกมแล้วอยากรวมยอด ก่อนนำเข้าจะให้ดูว่าอะไรเปลี่ยน ปุ่ม "ไฟล์ตัวอย่าง" ให้ไฟล์แม่แบบ`,
    ],
  },
  {
    href: "/calc",
    title: "คิดภาษี",
    lines: [
      "พิมพ์ชื่อไอเทม เลือกช่องราคาซื้อ/ขายจากราคาจริงในตลาด ใส่จำนวน ระบบคิดภาษี เงินที่ได้รับ กำไร/ขาดทุน และราคาเท่าทุน",
      `Value Pack / แหวนพ่อค้า / Family Fame ใช้ค่าจาก${SETTINGS_TITLE} เปลี่ยนในหน้านี้ได้ชั่วคราว (ไม่บันทึก) กด "คืนค่า" เพื่อกลับไปใช้ค่าที่ตั้งไว้`,
    ],
  },
  {
    href: "/account",
    title: "บัญชีของฉัน (สมาชิก)",
    lines: [
      "เปลี่ยนรหัสผ่าน ชื่อผู้ใช้สำหรับล็อกอิน และชื่อที่แสดง ได้ที่ \"บัญชีของฉัน\" ในเมนูชื่อของคุณมุมขวาบน",
      "ลืมรหัส: ให้แอดมินรีเซ็ตรหัสชั่วคราวให้ที่หน้า \"สมาชิก\" แล้วล็อกอินใหม่ ระบบจะให้ตั้งรหัสเอง",
    ],
  },
];

/** Who can use the site, and where their data is kept. */
const ACCESS_LINES = [
  "ใครก็ใช้หน้าแรก สูตร ตลาด คลัง คิดภาษี และวิธีใช้ได้ ไม่ต้องสมัคร ไม่ต้องล็อกอิน",
  "ถ้าไม่ล็อกอิน ค่าตั้งตัวละคร คลังของ และของที่เฝ้า เก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์ (ล้างข้อมูลเบราว์เซอร์แล้วจะหาย และไม่ตามไปเครื่องอื่น)",
  "ล็อกอินมีไว้สำหรับสมาชิกกิล: ข้อมูลเก็บในบัญชี เปิดเครื่องไหนก็เห็นเหมือนกัน บัญชีสร้างโดยแอดมินของกิล",
  "ล็อกอินครั้งแรกบนเครื่องที่เคยใช้แบบไม่ล็อกอิน ถ้าบัญชียังว่าง ระบบจะถามก่อนว่าจะนำข้อมูลในเครื่องเข้าบัญชีไหม (ถ้าบัญชีมีข้อมูลแล้ว ข้อมูลในเครื่องจะไม่ถูกนำเข้า)",
];

export default async function HelpPage() {
  const user = await getOptionalUser();
  return (
    <Page user={user && { username: user.username, displayName: user.displayName, role: user.role }} width="narrow">
      <PageHeader title="วิธีใช้" description={`${APP_NAME} แบบสั้น ๆ หน้าละไม่กี่บรรทัด`} />
      <div className="space-y-3">
        <Card>
          <CardHeader
            title="ใช้ได้ทุกคน"
            action={
              user ? undefined : (
                <Link href="/login?next=%2Fhelp" className={btn("ghost", "sm")}>
                  เข้าสู่ระบบ →
                </Link>
              )
            }
          />
          <ul className="list-disc space-y-1 py-3 pl-9 pr-4 text-sm text-muted">
            {ACCESS_LINES.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Card>
        {SECTIONS.map((s) => (
          <Card key={s.href}>
            <CardHeader
              title={s.title}
              action={
                <Link href={s.href} className={btn("ghost", "sm")}>
                  เปิดหน้า →
                </Link>
              }
            />
            <ul className="list-disc space-y-1 py-3 pl-9 pr-4 text-sm text-muted">
              {s.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Card>
        ))}
        <Card>
          <CardHeader title="สูตรที่ใช้คิด" />
          <ul className="list-disc space-y-1 py-3 pl-9 pr-4 text-sm text-muted">
            <li>{NET} = ราคาขาย × 0.65 × (1 + Value Pack 0.30 + Family Fame + แหวนพ่อค้า 0.05)</li>
            <li>ต้นทุนของแต่ละอย่าง = ถูกสุดระหว่าง ซื้อตลาด / ซื้อ NPC / ทำเองจากวัตถุดิบ (เลือกวัตถุดิบทดแทนที่ถูกสุดให้)</li>
            <li>ผลผลิตต่อรอบ = ค่าเฉลี่ยของสูตร ปรับด้วยโอกาสได้ผลผลิตเต็มจาก Mastery ของคุณ</li>
          </ul>
        </Card>
      </div>
    </Page>
  );
}
