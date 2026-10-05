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

/** A part of the page: `id` is its #anchor (the index links to it), `icon` its icon (for a page, the one its link has in the menus). */
type Part = { id: string; title: string; icon: IconName };

const SECTIONS: (Part & { href: string; lines: string[] })[] = [
  {
    id: "home",
    href: "/",
    title: "หน้าแรก",
    icon: "home",
    lines: [
      `ตั้งค่า Mastery แปรธาตุ/ทำอาหาร/แปรรูป และ Value Pack ครั้งแรกให้ตรงกับตัวละคร ตัวเลขทุกหน้าจะคิดจากค่านี้ แก้ทีหลังได้ที่ปุ่ม "${SETTINGS_TITLE}"`,
      `การ์ด "${HOME_PICKS_TITLE}" ด้านบนคือ 3 สูตรกำไรดีสุดจากทุกสาย (ไม่รวมกล่องราชวัง) เรียงตามกำไร/ชิ้น หรือกำไร/ชม. (ใช้ค่าเรียงเดียวกับหน้าคำนวณสูตร) ส่วนล่างของหน้าเป็นการ์ดของแต่ละสาย และของที่ตลาดกำลังขาด`,
      "การ์ด \"ทำอะไรได้จากของในคลัง\" บอกว่าของที่มีอยู่ (ไม่ต้องซื้อเพิ่ม) เอาไปทำอะไรได้กำไรกว่าขายวัตถุดิบตรง ๆ มากที่สุด ต้องใส่ของในหน้าคลังของก่อน ถ้าปักดาวของไว้จากหน้าสูตรหรือตลาด จะมีการ์ด \"ของที่ฉันเฝ้า\" ด้วย",
    ],
  },
  {
    id: "recipes",
    href: "/recipes",
    title: "คำนวณสูตร",
    icon: "book",
    lines: [
      "แท็บด้านบนเลือกสาย (ทั้งหมด / แปรธาตุ / ทำอาหาร / แปรรูป / ราชวัง) ช่อง \"เรียง:\" บนหัวการ์ด \"อันดับสูตร\" เลือกเรียงตามกำไร/ชิ้น ROI กำไร/รอบ กำไร/ชม. หรือต้นทุนต่ำสุด",
      "กดแถวเพื่อเปิดรายละเอียด (จอกว้างขึ้นในแผงด้านขวา จอแคบอย่างมือถือเปิดใต้แถวนั้น): กำไร ต้นทุน ROI วัตถุดิบทุกชั้นพร้อมราคาที่ใช้คิด และสูตรอื่นที่ทำของชิ้นเดียวกันได้",
      "แผนผลิต (ในรายละเอียดสูตร ใต้รายการวัตถุดิบ): ใส่จำนวนที่อยากได้ ระบบบอกว่าต้องซื้ออะไรเพิ่ม โดยหักของที่มีในคลังให้แล้ว ผลิตจริงแล้วกด \"ผลิตแล้ว\" ระบบจะหักวัตถุดิบออกจากคลังและเพิ่มผลผลิตเข้าคลังให้ (กดเลิกทำได้)",
      `ปุ่ม "ตั้งค่า" ด้านบนหน้าคำนวณสูตร หรือปุ่มรูปเฟืองมุมขวาบนของหน้าแรก สูตร ตลาด คลัง และคิดภาษี (ถ้าล็อกอินอยู่ จะอยู่ในเมนูบัญชี วงกลมตัวอักษรแรกของชื่อคุณ) เปิด "${SETTINGS_TITLE}": Mastery, ระดับทักษะ, รอบต่อชั่วโมง, Value Pack, แหวนพ่อค้า, Family Fame และ${OWNED_COST}: "${OWNED_COST_LABEL.market}", "${OWNED_COST_LABEL.avg}" หรือ "${OWNED_COST_LABEL.zero}"`,
    ],
  },
  {
    id: "market",
    href: "/market",
    title: "สแกนตลาด",
    icon: "chart",
    lines: [
      `"แนะนำวันนี้" มี 3 หมวด (จอกว้างเห็นครบทั้ง 3 จอแคบกดแท็บ ${SIGNAL_NAME.trade.short} / ${SIGNAL_NAME.buy.short} / ${SIGNAL_NAME.sell.short} สลับดู): ${SIGNAL_NAME.trade.name} (ซื้อตอนนี้ไปขายราคาปกติยังกำไร), ${SIGNAL_NAME.buy.name} (ถูกกว่าปกติและมีหลักฐานว่าจะฟื้น), ${SIGNAL_NAME.sell.name} (แพงกว่าปกติ)`,
      "กดแถวเพื่อดูหลักฐาน: ราคาเทียบ 90 วัน ของค้างขายหมดในกี่วัน แนวโน้ม 7 วัน และราคาย้อนหลัง",
      "ระบบดูแค่ราคา ของค้างขาย และยอดซื้อขาย ไม่รู้อีเวนต์ แพตช์ หรือของแจกล่วงหน้า ใช้เป็นข้อมูลประกอบ ไม่ใช่คำทำนาย",
      "แสดงเฉพาะไอเทมที่มีการซื้อขายใน 14 วัน ราคาอัปเดตเองเมื่อมีคนเปิดเว็บและข้อมูลเก่าเกิน 15 นาที (สมาชิกกด \"อัปเดตตลาดตอนนี้\" เองได้)",
    ],
  },
  {
    id: "inventory",
    href: "/inventory",
    title: "คลังของ",
    icon: "package",
    lines: [
      `พิมพ์ชื่อไอเทมเพื่อเพิ่ม (กด Enter = เพิ่มรายการแรก) ระบบจะเลื่อนไปที่แถวนั้นและไฮไลต์ให้ ค้นหาในคลัง หรือเรียงตาม ${Object.values(INVENTORY_SORT_LABEL).map((l) => `"${l}"`).join(" / ")} ได้`,
      `ต้นทุนต่อชิ้น: "ตามตลาด" ใช้ราคาตลาดตอนนี้เสมอ ส่วน "กำหนดเอง" ใส่ราคาที่จ่ายจริง ซึ่งจะใช้คิดกำไรเมื่อตั้ง "${OWNED_COST}" เป็น "${OWNED_COST_LABEL.avg}" ใน${SETTINGS_TITLE}`,
      `นำเข้า CSV: กด "นำเข้า / ส่งออก" แล้วเลือก "${IMPORT_MODE_LABEL.replace}" ถ้านำเข้าไฟล์เดิมซ้ำ หรือ "${IMPORT_MODE_LABEL.add}" ถ้าทำ CSV ทีละคลังในเกมแล้วอยากรวมยอด ก่อนนำเข้าจะให้ดูว่าอะไรเปลี่ยนบ้าง ปุ่ม "ไฟล์ตัวอย่าง" ให้ไฟล์แม่แบบไปกรอก`,
    ],
  },
  {
    id: "calc",
    href: "/calc",
    title: "คิดภาษี",
    icon: "calculator",
    lines: [
      `พิมพ์ชื่อไอเทม (ไม่บังคับ) แล้วเลือกราคาซื้อ/ขายจากช่องราคาจริงในตลาด ใส่จำนวน ระบบคิดภาษี เงินที่${NET} กำไร/ขาดทุน และราคาเท่าทุนให้`,
      `Value Pack / แหวนพ่อค้า / Family Fame ใช้ค่าจาก${SETTINGS_TITLE} เปลี่ยนในหน้าคิดภาษีได้ชั่วคราว (ไม่บันทึก) กด "คืนค่า" เพื่อกลับไปใช้ค่าที่ตั้งไว้`,
    ],
  },
  {
    id: "account",
    href: "/account",
    title: "บัญชีของฉัน (สมาชิก)",
    icon: "user",
    lines: [
      "เปลี่ยนรหัสผ่าน ชื่อผู้ใช้สำหรับล็อกอิน ชื่อที่แสดง หรือออกจากระบบทุกเครื่อง ได้ที่ \"บัญชีของฉัน\" ในเมนูบัญชีมุมขวาบน (วงกลมตัวอักษรแรกของชื่อคุณ)",
      "ลืมรหัส: ให้แอดมินตั้งรหัสชั่วคราวให้ (แอดมินทำได้ที่เมนู \"สมาชิก\") แล้วล็อกอินด้วยรหัสนั้น ระบบจะให้ตั้งรหัสใหม่ของคุณเองก่อนใช้งาน",
    ],
  },
];

/** Who can use the site, and where their data is kept. */
const ACCESS: Part = { id: "access", title: "ใช้ได้ทุกคน", icon: "users" };
const ACCESS_LINES = [
  "ใครก็ใช้หน้าแรก สูตร ตลาด คลัง คิดภาษี และวิธีใช้ได้ ไม่ต้องสมัคร ไม่ต้องล็อกอิน",
  "ถ้าไม่ล็อกอิน ค่าตั้งตัวละคร คลังของ และของที่เฝ้า เก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ได้บันทึกบนเซิร์ฟเวอร์ (ล้างข้อมูลเบราว์เซอร์แล้วจะหาย และไม่ตามไปเครื่องอื่น)",
  "ล็อกอินมีไว้สำหรับสมาชิกกิล: ข้อมูลเก็บในบัญชี เปิดเครื่องไหนก็เห็นเหมือนกัน บัญชีสร้างโดยแอดมินของกิล",
  "ล็อกอินบนเครื่องที่เคยใช้แบบไม่ล็อกอิน ถ้าบัญชียังว่าง (ไม่มีของในคลังและของที่เฝ้า) ระบบจะถามก่อนว่าจะนำข้อมูลในเครื่องเข้าบัญชีไหม ถ้าบัญชีมีข้อมูลแล้วจะไม่นำเข้า",
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
