import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { requireUser } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

const SECTIONS: { href: string; title: string; lines: string[] }[] = [
  {
    href: "/",
    title: "หน้าแรก",
    lines: [
      "ตั้งค่า Mastery แปรธาตุ/ทำอาหาร/แปรรูป และ Value Pack ครั้งแรกให้ตรงกับตัวละคร ตัวเลขทุกหน้าจะคิดจากค่านี้",
      "การ์ด \"วันนี้ควรทำอะไร\" คือสูตรกำไรดีสุดของแต่ละสาย และของที่ตลาดกำลังขาด",
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
      "\"ตั้งค่า\" มุมขวาบน: Mastery, Value Pack, แหวนพ่อค้า, รอบต่อชั่วโมง และของในคลังคิดต้นทุนเป็น 0 หรือราคาตลาด",
    ],
  },
  {
    href: "/market",
    title: "สแกนตลาด",
    lines: [
      "\"แนะนำวันนี้\" 3 กล่อง: เทรดได้กำไร (ซื้อตอนนี้ขายราคาปกติยังกำไร), น่าซื้อเก็บ (ถูกกว่าปกติและมีหลักฐานว่าจะฟื้น), น่าขายตอนนี้ (แพงกว่าปกติ)",
      "กดแถวเพื่อดูหลักฐาน: ราคาเทียบ 90 วัน ของค้างขายหมดในกี่วัน แนวโน้ม 7 วัน และราคาย้อนหลัง",
      "ระบบมองแค่ราคาและปริมาณซื้อขาย ไม่รู้อีเวนต์หรือของแจกล่วงหน้า ใช้เป็นข้อมูลประกอบ ไม่ใช่คำทำนาย",
      "แสดงเฉพาะไอเทมที่มีการซื้อขายใน 14 วัน ราคาอัปเดตทุก 5 นาทีเมื่อมีคนเปิดหน้า",
    ],
  },
  {
    href: "/inventory",
    title: "คลังของ",
    lines: [
      "พิมพ์ชื่อไอเทมเพื่อเพิ่ม แถวใหม่จะถูกเลื่อนมาให้เห็นและไฮไลต์ ค้นหาในคลังหรือเรียงตามชื่อ / เพิ่มล่าสุด / มูลค่าได้",
      "ต้นทุนต่อชิ้น: \"ตามตลาด\" ใช้ราคาปัจจุบันเสมอ หรือ \"กำหนดเอง\" ใส่ราคาที่จ่ายจริง",
      "นำเข้า CSV: เลือก \"ไฟล์ทับจำนวนเดิม\" เมื่อนำเข้าไฟล์เดิมซ้ำ หรือ \"ไฟล์บวกเพิ่มจากที่มี\" เมื่อทำ CSV ทีละคลังในเกมแล้วอยากรวมยอด ปุ่ม \"ไฟล์ตัวอย่าง CSV\" ให้ไฟล์แม่แบบ",
    ],
  },
  {
    href: "/calc",
    title: "คิดภาษี",
    lines: [
      "พิมพ์ชื่อไอเทม เลือกช่องราคาซื้อ/ขายจากราคาจริงในตลาด ใส่จำนวน ระบบคิดภาษี เงินที่ได้รับ กำไร/ขาดทุน และราคาเท่าทุน",
      "ติ๊ก Value Pack / แหวนพ่อค้า / Family Fame ให้ตรงกับตัวเอง",
    ],
  },
  {
    href: "/account",
    title: "บัญชี",
    lines: [
      "เปลี่ยนรหัสผ่าน ชื่อผู้ใช้สำหรับล็อกอิน และชื่อที่แสดง ได้ที่เมนู \"รหัสผ่าน\"",
      "ลืมรหัส: ให้แอดมินรีเซ็ตรหัสชั่วคราวให้ที่หน้า \"สมาชิก\" แล้วล็อกอินใหม่ ระบบจะให้ตั้งรหัสเอง",
    ],
  },
];

export default async function HelpPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-4 md:px-6">
      <TopNav user={user} subtitle={`วิธีใช้ ${APP_NAME} แบบสั้น ๆ หน้าละไม่กี่บรรทัด`} />
      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <section key={s.href} className="rounded-lg border border-border bg-panel p-4">
            <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-accent">
              {s.title}
              <Link href={s.href} className="rounded border border-border bg-panel-2 px-2 py-0.5 text-xs font-normal text-muted hover:text-foreground">
                เปิดหน้า
              </Link>
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {s.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        ))}
        <section className="rounded-lg border border-border bg-panel p-4 text-sm text-muted">
          <h2 className="mb-2 text-sm font-semibold text-accent">สูตรที่ใช้คิด</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>เงินที่ได้รับจริง = ราคาขาย × 0.65 × (1 + Value Pack 0.30 + Family Fame + แหวนพ่อค้า 0.05)</li>
            <li>ต้นทุนของแต่ละอย่าง = ถูกสุดระหว่าง ซื้อตลาด / ซื้อ NPC / ทำเองจากวัตถุดิบ (เลือกวัตถุดิบทดแทนที่ถูกสุดให้)</li>
            <li>ผลผลิตต่อรอบ = ค่าเฉลี่ยของสูตร ปรับด้วยโอกาสได้ผลผลิตเต็มจาก Mastery ของคุณ</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
