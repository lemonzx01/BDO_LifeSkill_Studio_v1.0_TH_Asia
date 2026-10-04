import Link from "next/link";
import { btn } from "@/components/ui/button";
import { Card, CardHeader, SectionLabel } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Page, PageHeader } from "@/components/ui/Page";
import { getOptionalUser } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/brand";
import { HOME_PICKS_TITLE } from "@/lib/home-picks";
import { IMPORT_MODE_LABEL } from "@/lib/inventory-import";
import { SIGNAL_NAME } from "@/lib/market/signals";
import { INVENTORY_SORT_LABEL, NET, OWNED_COST, OWNED_COST_LABEL, SETTINGS_TITLE } from "@/lib/settings-labels";

export const dynamic = "force-dynamic";

/** A part of the page: `id` is its #anchor (the index links to it), `icon` the page's icon in the top bar. */
type Part = { id: string; title: string; icon: IconName };

const SECTIONS: (Part & { href: string; lines: string[] })[] = [
  {
    id: "home",
    href: "/",
    title: "หน้าแรก",
    icon: "home",
    lines: [
      `ตั้งค่า Mastery แปรธาตุ/ทำอาหาร/แปรรูป และ Value Pack ครั้งแรกให้ตรงกับตัวละคร ตัวเลขทุกหน้าจะคิดจากค่านี้ แก้ทีหลังได้ที่ปุ่ม "${SETTINGS_TITLE}"`,
      `การ์ด "${HOME_PICKS_TITLE}" ด้านบนคือ 3 สูตรกำไรดีสุดจากทุกสาย (ไม่รวมกล่องราชวัง) เรียงตามกำไร/ชิ้น หรือกำไร/ชม. (ค่าเดียวกับหน้าคำนวณสูตร) ใต้ลงมาเป็นการ์ดของแต่ละสาย และของที่ตลาดกำลังขาด`,
      "ถ้าใส่ของในคลังไว้ จะมีกล่อง \"ทำอะไรได้จากของในคลัง\" บอกว่าของที่มีทำอะไรแล้วได้เงินมากที่สุด",
    ],
  },
  {
    id: "recipes",
    href: "/recipes",
    title: "คำนวณสูตร",
    icon: "book",
    lines: [
      "แท็บด้านบนเลือกสาย (แปรธาตุ / ทำอาหาร / แปรรูป / ราชวัง) เรียงตามกำไรต่อชิ้น ROI หรือกำไรต่อชั่วโมง",
      "กดแถวเพื่อดูวัตถุดิบเป็นชั้น ๆ ราคาที่ใช้คิด และสูตรทางเลือกอื่นของสินค้าเดียวกัน",
      "แผนผลิตด้านล่าง: ใส่จำนวนที่อยากได้ ระบบบอกว่าต้องซื้ออะไรเพิ่ม ใช้ของในคลังที่มีอยู่แล้วหักให้ พอผลิตจริงกด \"ผลิตแล้ว\" จะหักวัตถุดิบและเพิ่มผลผลิตเข้าคลัง",
      `"ตั้งค่า" ในหน้านี้ หรือปุ่มตั้งค่า (รูปเฟือง) มุมขวาบน ใช้ได้ทุกหน้า (ถ้าล็อกอินอยู่จะอยู่ในเมนูชื่อของคุณ): Mastery, Value Pack, แหวนพ่อค้า, รอบต่อชั่วโมง และ${OWNED_COST}: "${OWNED_COST_LABEL.market}", "${OWNED_COST_LABEL.avg}" หรือ "${OWNED_COST_LABEL.zero}"`,
    ],
  },
  {
    id: "market",
    href: "/market",
    title: "สแกนตลาด",
    icon: "chart",
    lines: [
      `"แนะนำวันนี้" 3 กล่อง: ${SIGNAL_NAME.trade.name} (ซื้อตอนนี้ขายราคาปกติยังกำไร), ${SIGNAL_NAME.buy.name} (ถูกกว่าปกติและมีหลักฐานว่าจะฟื้น), ${SIGNAL_NAME.sell.name} (แพงกว่าปกติ)`,
      "กดแถวเพื่อดูหลักฐาน: ราคาเทียบ 90 วัน ของค้างขายหมดในกี่วัน แนวโน้ม 7 วัน และราคาย้อนหลัง",
      "ระบบมองแค่ราคาและปริมาณซื้อขาย ไม่รู้อีเวนต์หรือของแจกล่วงหน้า ใช้เป็นข้อมูลประกอบ ไม่ใช่คำทำนาย",
      "แสดงเฉพาะไอเทมที่มีการซื้อขายใน 14 วัน ราคาอัปเดตทุกราว 15 นาทีเมื่อมีคนเปิดเว็บ (สมาชิกกดอัปเดตเองได้)",
    ],
  },
  {
    id: "inventory",
    href: "/inventory",
    title: "คลังของ",
    icon: "package",
    lines: [
      `พิมพ์ชื่อไอเทมเพื่อเพิ่ม แถวใหม่จะถูกเลื่อนมาให้เห็นและไฮไลต์ ค้นหาในคลังหรือเรียงตาม${Object.values(INVENTORY_SORT_LABEL).join(" / ")}ได้`,
      `ต้นทุนต่อชิ้น: "ตามตลาด" ใช้ราคาปัจจุบันเสมอ หรือ "กำหนดเอง" ใส่ราคาที่จ่ายจริง ซึ่งใช้คิดกำไรเมื่อตั้ง "${OWNED_COST}" เป็น "${OWNED_COST_LABEL.avg}" ใน${SETTINGS_TITLE}`,
      `นำเข้า CSV: กด "นำเข้า / ส่งออก" แล้วเลือก "${IMPORT_MODE_LABEL.replace}" เมื่อนำเข้าไฟล์เดิมซ้ำ หรือ "${IMPORT_MODE_LABEL.add}" เมื่อทำ CSV ทีละคลังในเกมแล้วอยากรวมยอด ก่อนนำเข้าจะให้ดูว่าอะไรเปลี่ยน ปุ่ม "ไฟล์ตัวอย่าง" ให้ไฟล์แม่แบบ`,
    ],
  },
  {
    id: "calc",
    href: "/calc",
    title: "คิดภาษี",
    icon: "calculator",
    lines: [
      "พิมพ์ชื่อไอเทม เลือกช่องราคาซื้อ/ขายจากราคาจริงในตลาด ใส่จำนวน ระบบคิดภาษี เงินที่ได้รับ กำไร/ขาดทุน และราคาเท่าทุน",
      `Value Pack / แหวนพ่อค้า / Family Fame ใช้ค่าจาก${SETTINGS_TITLE} เปลี่ยนในหน้านี้ได้ชั่วคราว (ไม่บันทึก) กด "คืนค่า" เพื่อกลับไปใช้ค่าที่ตั้งไว้`,
    ],
  },
  {
    id: "account",
    href: "/account",
    title: "บัญชีของฉัน (สมาชิก)",
    icon: "user",
    lines: [
      "เปลี่ยนรหัสผ่าน ชื่อผู้ใช้สำหรับล็อกอิน และชื่อที่แสดง ได้ที่ \"บัญชีของฉัน\" ในเมนูชื่อของคุณมุมขวาบน",
      "ลืมรหัส: ให้แอดมินรีเซ็ตรหัสชั่วคราวให้ที่หน้า \"สมาชิก\" แล้วล็อกอินใหม่ ระบบจะให้ตั้งรหัสเอง",
    ],
  },
];

/** Who can use the site, and where their data is kept. */
const ACCESS: Part = { id: "access", title: "ใช้ได้ทุกคน", icon: "users" };
const ACCESS_LINES = [
  "ใครก็ใช้หน้าแรก สูตร ตลาด คลัง คิดภาษี และวิธีใช้ได้ ไม่ต้องสมัคร ไม่ต้องล็อกอิน",
  "ถ้าไม่ล็อกอิน ค่าตั้งตัวละคร คลังของ และของที่เฝ้า เก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์ (ล้างข้อมูลเบราว์เซอร์แล้วจะหาย และไม่ตามไปเครื่องอื่น)",
  "ล็อกอินมีไว้สำหรับสมาชิกกิล: ข้อมูลเก็บในบัญชี เปิดเครื่องไหนก็เห็นเหมือนกัน บัญชีสร้างโดยแอดมินของกิล",
  "ล็อกอินครั้งแรกบนเครื่องที่เคยใช้แบบไม่ล็อกอิน ถ้าบัญชียังว่าง ระบบจะถามก่อนว่าจะนำข้อมูลในเครื่องเข้าบัญชีไหม (ถ้าบัญชีมีข้อมูลแล้ว ข้อมูลในเครื่องจะไม่ถูกนำเข้า)",
];

/** How the numbers are worked out: each rule as its name, then what it equals. */
const FORMULAS: Part = { id: "formulas", title: "สูตรที่ใช้คิด", icon: "percent" };
const FORMULA_LINES: { term: string; rule: string }[] = [
  { term: NET, rule: "ราคาขาย × 0.65 × (1 + Value Pack 0.30 + Family Fame + แหวนพ่อค้า 0.05)" },
  { term: "ต้นทุนของแต่ละอย่าง", rule: "ถูกสุดระหว่าง ซื้อตลาด / ซื้อ NPC / ทำเองจากวัตถุดิบ (เลือกวัตถุดิบทดแทนที่ถูกสุดให้)" },
  { term: "ผลผลิตต่อรอบ", rule: "ค่าเฉลี่ยของสูตร ปรับด้วยโอกาสได้ผลผลิตเต็มจาก Mastery ของคุณ" },
];

/** The index of the page, in the order the parts appear. */
const INDEX: Part[] = [ACCESS, ...SECTIONS, FORMULAS];

// one line of help: a bordered row, body colour (this page is for reading)
const ROW = "px-4 py-3 text-sm text-foreground";

export default async function HelpPage() {
  const user = await getOptionalUser();
  return (
    <Page user={user && { username: user.username, displayName: user.displayName, role: user.role }} width="narrow">
      <PageHeader title="วิธีใช้" description={`${APP_NAME} แบบสั้น ๆ หน้าละไม่กี่บรรทัด`} />
      {/* most come for one page's help, so the index of the parts comes first: a row of chips on top
          below lg, a list that stays in view on the right from lg. The text keeps a reading width
          (max-w-prose) */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-start lg:gap-8">
        <nav aria-label="หัวข้อในหน้านี้" className="mb-4 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:col-start-2 lg:row-start-1 lg:mb-0">
          <SectionLabel as="div" className="mb-2 hidden px-2.5 lg:block">
            ในหน้านี้
          </SectionLabel>
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
            {INDEX.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-panel px-3 text-xs text-muted transition-colors duration-150 hover:border-border-strong hover:text-foreground md:min-h-8 lg:flex lg:min-h-9 lg:rounded-lg lg:border-transparent lg:bg-transparent lg:px-2.5 lg:text-sm lg:hover:border-transparent lg:hover:bg-panel-2"
                >
                  <Icon name={s.icon} className="hidden h-4 w-4 lg:block" />
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* scroll-mt-4: a part opened from the index stops a little below the top bar */}
        <div className="min-w-0 max-w-prose space-y-4 lg:col-start-1 lg:row-start-1">
          <Card id={ACCESS.id} className="scroll-mt-4">
            <CardHeader
              icon={ACCESS.icon}
              title={ACCESS.title}
              action={
                user ? undefined : (
                  <Link href="/login?next=%2Fhelp" className={btn("ghost", "sm")}>
                    <Icon name="log-in" className="h-4 w-4" />
                    เข้าสู่ระบบ
                  </Link>
                )
              }
            />
            <ul className="divide-y divide-border">
              {ACCESS_LINES.map((l) => (
                <li key={l} className={ROW}>
                  {l}
                </li>
              ))}
            </ul>
          </Card>
          {SECTIONS.map((s) => (
            <Card key={s.id} id={s.id} className="scroll-mt-4">
              <CardHeader
                icon={s.icon}
                title={s.title}
                action={
                  <Link href={s.href} className={btn("ghost", "sm")}>
                    {/* several "เปิดหน้า" links on one page: the page's name is added for screen readers */}
                    เปิดหน้า<span className="sr-only"> {s.title}</span>
                    <Icon name="arrow-right" className="h-4 w-4" />
                  </Link>
                }
              />
              <ul className="divide-y divide-border">
                {s.lines.map((l) => (
                  <li key={l} className={ROW}>
                    {l}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <Card id={FORMULAS.id} className="scroll-mt-4">
            <CardHeader icon={FORMULAS.icon} title={FORMULAS.title} />
            <ul className="divide-y divide-border">
              {FORMULA_LINES.map((f) => (
                <li key={f.term} className={ROW}>
                  <p className="font-medium">
                    {f.term} <span className="text-muted">=</span>
                  </p>
                  <p className="num mt-0.5 text-muted">{f.rule}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Page>
  );
}
