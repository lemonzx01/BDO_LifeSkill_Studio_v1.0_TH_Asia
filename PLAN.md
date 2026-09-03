# BDO LifeSkill Studio (Web) — แผนงาน

อัปเดต: 2026-09-04 · เซิร์ฟเวอร์เป้าหมาย: **Asia** (TH ถูกรวมเข้ากับ Asia แล้ว)

## 1. บริบท

- ต้นแบบคือไฟล์ `BDO_LifeSkill_Studio_v2.0_TH_Asia.xlsx` (Alchemy Edition) ที่คำนวณ ต้นทุน / รับสุทธิ / กำไร / ROI ของสูตรแปรธาตุแบบซ้อนกัน 7 ชั้น พร้อมแผนผลิตและของที่ต้องซื้อเพิ่ม แต่ราคาตลาดต้องกรอกเอง
- เป้าหมายใหม่: ทำเป็นเว็บ ดึงราคาตลาดสดจาก API, ครอบคลุม **แปรธาตุ + ทำอาหาร + แปรรูป** และ **วิเคราะห์เทรดของทั้งตลาด** (ซื้อถูกขายแพง + ตลาดมีสภาพคล่อง) ใช้เฉพาะคนในกิล (มีล็อกอิน)
- อ้างอิง UI จาก https://bdo-harmony-planner-v2.vercel.app/ (Next.js บน Vercel, ธีมมืด, ภาษาไทย, export/import)

## 2. ผลสำรวจแหล่งข้อมูล (ทดสอบจริงแล้ว)

| แหล่ง | ใช้ทำอะไร | สถานะ | หมายเหตุ |
|---|---|---|---|
| **API ทางการ** `https://asia-trade.blackdesert.pearlabyss.com/Trademarket/*` | ราคาปัจจุบัน, ราคาย้อนหลัง 90 วัน, batch ค้นหาหลาย id | ใช้ได้ | `GetWorldMarketSubList`, `GetWorldMarketSearchList`, `GetMarketPriceInfo` ตอบ JSON ตรง ๆ ส่วน `GetWorldMarketList` / `GetBiddingInfoList` / `GetWorldMarketHotList` ตอบเป็นข้อมูลบีบอัดแบบเฉพาะ ต้องถอดรหัสเอง (หรือใช้ arsha แทน) · ไม่มี CORS ต้องเรียกจากฝั่ง server |
| **arsha.io** `https://api.arsha.io/v2/th/*` | เหมือนทางการแต่เป็น JSON ถอดรหัสแล้ว, `lang=th` ได้ชื่อไทย, CORS เปิด | ใช้ได้แต่ล่มเป็นพัก ๆ | region `th` = `sea` = ตลาด Asia เดียวกัน · `price` และ `GetMarketPriceInfo` ล่มตอนทดสอบ ใช้เป็น fallback/ตัวถอดรหัส |
| **bdocodex** `https://bdocodex.com/query.php?a=recipes|mrecipes&...&l=th` | ฐานสูตรทั้งหมดภาษาไทย | ดึงได้ | แปรธาตุ 209 · ทำอาหาร 554 · แปรรูป/ผลิต (mrecipes) 7,267 แถว มีวัตถุดิบ+จำนวน+ผลผลิต+ระดับทักษะ · **import ครั้งเดียวเป็น JSON** ไม่ดึงสด |
| **bdolytics** tRPC `market.getMarket` region `ASIA` | snapshot ทั้งตลาด 10,040 ไอเท็มในคำขอเดียว + ปริมาณซื้อขาย 14 วัน | ดึงได้ | API ภายในไม่เป็นทางการ ใช้เป็นตัวเสริม (volume) มี fallback เสมอ · `database.getItem` ไม่มีข้อมูลสูตร |
| garmoth | — | ไม่มี API สาธารณะ | ใช้แค่อ้างอิง |

ข้อสังเกตจากตลาด Asia: วัตถุดิบยอดนิยม (เช่น น้ำยาเคมีใส) stock = 0 และมีคนรอซื้อหลักพัน ดังนั้นกำไรบนกระดาษ ≠ ทำได้จริง เว็บต้องโชว์สภาพคล่องคู่กับกำไรเสมอ

### บั๊กใน Excel ที่จะแก้ในเว็บ
- อัตรารับเงินใน Excel = `MIN(1, 0.65 + VP + Fame + อื่น)` → 0.95 · ของจริงในเกม = `0.65 × (1 + VP 0.30 + Fame 0.005–0.015 + แหวนพ่อค้า 0.05)` → 0.845–0.887 · Excel ประเมินรายรับสูงเกินจริง ~10%

## 3. สถาปัตยกรรม

```
[Browser]  ── Next.js (App Router, TS, Tailwind) ── Vercel
               ├─ /api/market/*      → อ่านจาก DB cache (ไม่ยิง API ทางการตรงจากหน้าเว็บ)
               ├─ Vercel Cron 10–15 นาที → ingest ราคาทั้งตลาดลง DB (official → arsha → bdolytics ตามลำดับ)
               ├─ on-demand: ราคาย้อนหลัง 90 วัน / order book ของไอเท็มที่เปิดดู (cache 10 นาที)
               ├─ Auth.js v5 (Credentials) → แอดมินสร้างบัญชี/รหัสผ่านให้สมาชิก กำหนด role, ปิด/ลบได้ทันที
               └─ Postgres (Neon free tier) + Drizzle ORM
[Static data]  data/items.json, data/recipes.json  ← scripts/import-bdocodex.ts (รันใหม่เมื่อมีแพตช์)
```

- คำนวณต้นทุน/กำไรทำที่ฝั่ง client (engine ล้วน ๆ ไม่มี IO) เพื่อให้สลับตัวเลือกแล้วเห็นผลทันที
- ราคามาจาก snapshot ล่าสุดใน DB + เวลาที่อัปเดต แสดงบนหน้าจอเสมอ

## 4. โมเดลข้อมูล

- `items` — id (เกม), ชื่อไทย/อังกฤษ, หมวด, ไอคอน, ราคา NPC ซื้อ/ขาย, น้ำหนัก, ซื้อขายตลาดได้ไหม
- `recipes` — id, ประเภท (alchemy / cooking / processing:heating|grind|dry|shake|thinning|chop|simple-alchemy|simple-cooking|manufacture), ระดับทักษะ, EXP, ผลผลิต (min–max), ผลพลอยได้
- `recipe_materials` — recipe_id, group (สำหรับ "A หรือ B"), item_id, จำนวน
- `market_snapshot` — item_id, sid, base_price, stock, total_trades, updated_at
- `market_history` — item_id, date, price (90 วัน) · `market_orders` — order book ล่าสุด (cache)
- `market_volume` — item_id, volume_14d (จาก bdolytics ถ้ามี)
- `users`, `guild_whitelist`/`memberships`, `user_settings` (VP, Fame, แหวน, mastery, ผลผลิตเฉลี่ย), `user_inventory` (item, จำนวน, ต้นทุนเฉลี่ย), `production_plans`

## 5. Engine คำนวณ (พอร์ตจาก Excel + แก้ไข)

- `netRate = 0.65 × (1 + vp + fame + ring)`
- `cost(item, mode)`:
  - มีของในคลัง → มุมมอง A: ต้นทุน 0 / ต้นทุนเฉลี่ยที่บันทึก · มุมมอง B: ราคาตลาด (ค่าเสียโอกาส) · สลับได้ทั้งหน้า
  - ไม่มีในคลัง → `min(ต้นทุนทำเอง, ราคาตลาดซื้อ)` แบบอัตโนมัติ + override ต่อไอเท็มได้ (บังคับซื้อ / บังคับทำ)
  - ไม่มีสูตรและตลาดไม่มีของ → ราคา NPC / ราคาประเมินที่ผู้ใช้กรอก + ธง "ไม่มีในตลาด"
  - วัตถุดิบแบบ "A หรือ B" → เลือกตัวถูกสุดที่มีของ
- `craftCost = Σ(qty × cost) ÷ avgYield` · avgYield จากผู้ใช้กรอก (default จากตาราง mastery)
- `profit = price × netRate − cost`, `roi = profit / cost`, `profitPerCraft`, `profitPerHour` (จำนวนรอบ/ชม. กรอกเอง)
- แผนผลิต: จำนวนที่ต้องการ → รอบ = ceil(qty ÷ avgYield) → วัตถุดิบรวม − ในคลัง = ต้องซื้อเพิ่ม (ราคา × จำนวน) เหมือน Excel แต่ขยายลงทุกชั้น
- คะแนนเทรด (ต่อไอเท็ม):
  - ราคาปัจจุบันเทียบค่าเฉลี่ย 30/90 วัน และตำแหน่งในกรอบ min–max
  - สภาพคล่อง: total_trades, volume 14 วัน, จำนวนคนรอซื้อ vs ของค้างขาย
  - กำไรคาดหวังถ้าซื้อตอนนี้แล้วขายที่ค่าเฉลี่ยสูง = `avgHigh × netRate − priceNow` (ต้องขึ้น > 18% ถึงคุ้มภาษี)
  - ธง: "ซื้อยาก" (stock 0 + buyers รอ), "ขายยาก" (ค้างขายเยอะ), "ตลาดตาย" (trades ต่ำ)

## 6. หน้าจอ

1. **จัดอันดับกำไร** — เลือกสกิล (แปรธาตุ/อาหาร/แปรรูป), ระดับทักษะที่มี, เรียงตาม กำไร/ROI/กำไรต่อชั่วโมง, กรองเฉพาะที่ซื้อวัตถุดิบได้จริง
2. **รายละเอียดสูตร** — ผังต้นทุนแบบต้นไม้ สลับซื้อ/ทำต่อชั้น ราคาสด กราฟ 90 วัน order book
3. **สแกนตลาด / เทรด** — ตารางทั้งตลาด 10k ไอเท็ม กรอง/เรียงตามคะแนนเทรด สภาพคล่อง หมวด
4. **คลังของฉัน** — จำนวน + ต้นทุนเฉลี่ย, import จาก Excel เดิม (ชีต `คลังวัตถุดิบ`)
5. **แผนผลิต** — เลือกสินค้า + จำนวน → รอบ, วัตถุดิบทุกชั้น, ของที่ต้องซื้อเพิ่ม, ต้นทุนรวม/กำไรรวม
6. **ตั้งค่า** — VP, Fame, แหวน, mastery/ผลผลิตเฉลี่ยต่อสกิล, รอบต่อชั่วโมง
7. **Admin (หัวกิล)** — จัดการสมาชิก/whitelist, ดูสถานะการอัปเดตราคา

## 7. เฟสงาน

| เฟส | ส่งมอบ | สถานะ (2026-09-04) |
|---|---|---|
| 0 · Setup | Next.js 16 + Tailwind 4 + vitest · สคริปต์ import bdocodex/bdolytics · ตัวดึงราคา (ทางการ → arsha) + cache 5 นาที | ✅ เสร็จ (ยังไม่มี DB/ล็อกอิน) |
| 1 · Core calc | Engine + 12 tests (ตรงกับ Excel) · จัดอันดับกำไร แปรธาตุ 209 + ทำอาหาร 321 สูตร · รายละเอียดสูตร (ต้นไม้วัตถุดิบ, ราคาย้อนหลัง 90 วัน, order book) · ตั้งค่า (VP/Fame/แหวน/Mastery) · แผนผลิต + "มีอยู่แล้ว" · ตัวกรองขาดตลาด | ✅ ใช้งานได้ |
| 1.5 · ล็อกอิน | บัญชีที่แอดมินสร้าง (bcrypt + DB session) · role admin/member · ปิด/ลบ/รีเซ็ตรหัส · บังคับตั้งรหัสใหม่ครั้งแรก · Drizzle + Neon (prod) / PGlite (dev) · 7 tests | ✅ ใช้งานได้ |
| 2 · ตลาด/เทรด | สแกนตลาดทั้งเกม 10k ไอเท็ม, คะแนนเทรด, volume จาก bdolytics, cron snapshot ลง DB | ⏳ |
| 3 · แปรรูป + คลัง | import mrecipes 7,267 แถว, คลังของฉันแบบเต็ม (ย้ายจาก localStorage ไป DB), import Excel เดิม | ⏳ |
| 4 · กิล | admin, แชร์แผน/ราคาโน้ตในกิล, export CSV/Excel, PWA | ⏳ |

หมายเหตุการตัดสินใจระหว่างทำ: ล็อกอินเปลี่ยนจาก Discord เป็นบัญชีที่แอดมินสร้างให้ (ผู้ใช้ต้องการควบคุม/ปิดสิทธิ์ได้เอง) · ผลผลิตเฉลี่ยคิดจาก Mastery ตามตารางเกม (`src/lib/engine/mastery.ts`) · วัตถุดิบทดแทนใช้จำนวนเต็มต่อรอบ (ปัดขึ้น) · การเรียงเริ่มต้นใช้ กำไร/ชิ้น

## 8. สิ่งที่ต้องเตรียมฝั่งผู้ใช้

- บัญชี Vercel (มีแล้วจาก harmony planner), GitHub repo นี้
- Discord Developer Portal → สร้าง Application (Client ID / Secret) + Guild ID ของ Discord กิล
- Neon (หรือ Supabase) Postgres free tier → connection string
- ค่า mastery แปรธาตุ/ทำอาหาร และรอบต่อชั่วโมงโดยประมาณ (สำหรับ default)

## 9. ความเสี่ยงและวิธีรับมือ

- arsha ล่มบ่อย → cache ใน DB + fallback หลายชั้น + แสดง "อัปเดตล่าสุดเมื่อ"
- endpoint ทางการบางตัวบีบอัดแบบเฉพาะ → ใช้ arsha ถอดให้ก่อน ถ้าจำเป็นค่อยพอร์ตตัวถอดรหัส
- bdocodex/bdolytics ไม่ใช่ API สาธารณะ → import ครั้งเดียว + ใส่เครดิต ไม่ยิงถี่
- สูตรมีทางเลือก ("หญ้าป่า หรือ วัชพืช") และผลผลิตขึ้นกับ mastery → รองรับ group + ให้กรอก avgYield
- ตลาด Asia ของหลายตัว stock 0 → ธงสภาพคล่องต้องเด่น ไม่ให้ตัวเลขกำไรหลอก

## 10. การตรวจสอบ

- Unit test engine: ป้อนข้อมูลจาก Excel (ตั้งค่า + สูตร ELX001/ELX003) ต้องได้ต้นทุนเท่ากัน ยกเว้นส่วน netRate ที่แก้สูตร
- ทดสอบ ingest: cron รันแล้ว snapshot ครบ ≥ 9,000 ไอเท็ม เวลาอัปเดตไม่เกิน 15 นาที
- ตรวจราคาสุ่ม 5 ไอเท็มเทียบกับในเกมจริง
- ล็อกอินด้วยบัญชี Discord ที่อยู่/ไม่อยู่ในกิล ต้องผ่าน/ถูกปฏิเสธถูกต้อง
