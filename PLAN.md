# BDO Life by BloodMoon TH — แผนงานและประวัติ

อัปเดต: 2026-10-04 · เซิร์ฟเวอร์เป้าหมาย: **Asia** (TH ถูกรวมเข้ากับ Asia แล้ว) · ชื่อตอนวางแผนคือ BDO LifeSkill Studio (ชื่อเว็บตอนนี้อยู่ใน `src/lib/brand.ts`)

## 1. บริบท

- ต้นแบบคือไฟล์ `BDO_LifeSkill_Studio_v2.0_TH_Asia.xlsx` (Alchemy Edition) ที่คำนวณ ต้นทุน / รับสุทธิ / กำไร / ROI ของสูตรแปรธาตุแบบซ้อนกัน 7 ชั้น พร้อมแผนผลิตและของที่ต้องซื้อเพิ่ม แต่ราคาตลาดต้องกรอกเอง
- เป้าหมาย: ทำเป็นเว็บ ดึงราคาตลาดสดจาก API, ครอบคลุม **แปรธาตุ + ทำอาหาร + แปรรูป** (ภายหลังเพิ่มกล่องราชวัง) และ **วิเคราะห์เทรดของทั้งตลาด** (ซื้อถูกขายแพง + ตลาดมีสภาพคล่อง)
- เดิมวางไว้ให้ใช้เฉพาะคนในกิล (ต้องล็อกอิน) · ตั้งแต่ 2026-10-02 **ใครก็ใช้ได้โดยไม่ต้องล็อกอิน** (ข้อมูลเก็บในเบราว์เซอร์) ล็อกอินมีไว้ให้สมาชิกกิลเก็บข้อมูลไว้ในบัญชี เปิดเครื่องไหนก็เห็น และให้แอดมินจัดการสมาชิก · ยังตั้ง `noindex` (ไม่ให้ search engine เก็บ)
- ตอนเริ่มอ้างอิง UI จาก https://bdo-harmony-planner-v2.vercel.app/ (Next.js บน Vercel, ธีมมืด, ภาษาไทย, export/import) · หน้าตาปัจจุบันคือธีม "Adventurer's Ledger" ดู `design-system/bdo-lifeskill-studio/MASTER.md`

## 2. ผลสำรวจแหล่งข้อมูล (ทดสอบจริงตอนวางแผน 2026-09-04)

| แหล่ง | ใช้ทำอะไร | สถานะ | หมายเหตุ |
|---|---|---|---|
| **API ทางการ** `https://asia-trade.blackdesert.pearlabyss.com/Trademarket/*` | ราคาปัจจุบัน, ราคาย้อนหลัง 90 วัน, batch ค้นหาหลาย id | ใช้ได้ | `GetWorldMarketSubList`, `GetWorldMarketSearchList`, `GetMarketPriceInfo` ตอบ JSON ตรง ๆ ส่วน `GetWorldMarketList` / `GetBiddingInfoList` / `GetWorldMarketHotList` ตอบเป็นข้อมูลบีบอัดแบบเฉพาะ ต้องถอดรหัสเอง (หรือใช้ arsha แทน) · ไม่มี CORS ต้องเรียกจากฝั่ง server · ภายหลังพบว่าตอนถูกจำกัดจะตอบเป็นหน้า HTML แทน JSON |
| **arsha.io** `https://api.arsha.io/v2/th/*` | เหมือนทางการแต่เป็น JSON ถอดรหัสแล้ว, `lang=th` ได้ชื่อไทย, CORS เปิด | ใช้ได้แต่ล่มเป็นพัก ๆ | region `th` = `sea` = ตลาด Asia เดียวกัน · `price` และ `GetMarketPriceInfo` ล่มตอนทดสอบ ใช้เป็น fallback ราคา และตัวถอดรหัส order book |
| **bdocodex** `https://bdocodex.com/query.php?a=recipes|mrecipes&...&l=th` | ฐานสูตรทั้งหมดภาษาไทย | ดึงได้ | แปรธาตุ 209 · ทำอาหาร 554 · แปรรูป/ผลิต (mrecipes) 7,267 แถว มีวัตถุดิบ+จำนวน+ผลผลิต+ระดับทักษะ · **import ครั้งเดียวเป็น JSON** ไม่ดึงสด |
| **bdolytics** tRPC `market.getMarket` region `ASIA` | snapshot ทั้งตลาด 10,040 ไอเท็มในคำขอเดียว + ปริมาณซื้อขาย 14 วัน | ดึงได้ | API ภายในไม่เป็นทางการ · ตอนวางแผนตั้งใจใช้เป็นตัวเสริม แต่ตอนนี้เป็น**แหล่งหลักของ snapshot ตลาด** (1 คำขอต่อการรีเฟรช) ถ้าล่มใช้ API ทางการแทน · `database.getItem` ไม่มีข้อมูลสูตร |
| garmoth | — | ไม่มี API สาธารณะ | ใช้แค่อ้างอิง |

ข้อสังเกตจากตลาด Asia: วัตถุดิบยอดนิยม (เช่น น้ำยาเคมีใส) stock = 0 และมีคนรอซื้อหลักพัน ดังนั้นกำไรบนกระดาษ ≠ ทำได้จริง เว็บต้องโชว์สภาพคล่องคู่กับกำไรเสมอ

### บั๊กใน Excel ที่แก้ในเว็บแล้ว
- อัตรารับเงินใน Excel = `MIN(1, 0.65 + VP + Fame + อื่น)` → 0.95 · ของจริงในเกม = `0.65 × (1 + VP 0.30 + Fame 0.005–0.015 + แหวนพ่อค้า 0.05)` → 0.845–0.887 · Excel ประเมินรายรับสูงเกินจริง ~10%

## 3. สถาปัตยกรรม (ที่ใช้งานจริง)

```
[Browser] ── Next.js 16 (App Router, React 19, TS, Tailwind 4) ── Vercel (function region sin1 ตาม vercel.json)
   │  src/proxy.ts: CSP + nonce ต่อ request · next.config.ts: security headers
   │  ไม่ล็อกอิน: ตั้งค่า/คลัง/ของที่เฝ้า อยู่ใน localStorage (bls:guest:v1:*) · สมาชิก: อยู่ใน DB
   ├─ /api/data            ฐานสูตร+ไอเท็ม (src/data/*.json) ETag + CDN cache
   ├─ /api/prices, /market อ่าน snapshot ใน DB · เก่ากว่า 15 นาทีรีเฟรชเบื้องหลัง (ไม่เกิน 1 ครั้ง/15 นาที)
   │                       /api/prices ของสมาชิก: snapshot เก่ากว่า 5 นาที ถามต้นทางตรง (ทางการ → arsha) cache 5 นาที
   ├─ /api/market/[id]     ราคาย้อนหลัง 90 วัน (ทางการ) + order book (arsha) cache 5 นาที
   │                       คนไม่ล็อกอินใช้โควตาถามต้นทางร่วมกัน 300 ครั้ง/15 นาที เกินแล้วได้แค่ประวัติใน DB
   ├─ Vercel Cron 03:00 UTC (10:00 เวลาไทย) → /api/cron/market
   │                       รีเฟรช snapshot (bdolytics → ทางการ) + backfill ประวัติ 150 ไอเท็ม + ล้างตัวนับ throttle ที่หมดอายุเกิน 1 วัน
   ├─ Auth เขียนเอง (src/lib/auth): bcrypt + session ใน DB, cookie httpOnly · role owner / admin / member
   ├─ UsageBeacon → POST /api/track → ตาราง usage_* → /admin/stats
   └─ Drizzle ORM → Supabase Postgres (production: postgres.js ผ่าน transaction pooler)
                    PGlite ในเครื่อง (.data/pglite) เมื่อไม่ได้ตั้ง DATABASE_URL / POSTGRES_URL
[Static data]  src/data/items.json, recipes.json, meta.json ← scripts/import-bdocodex.mjs (รันใหม่เมื่อมีแพตช์)
```

- คำนวณต้นทุน/กำไรทำที่ฝั่ง client (engine ล้วน ๆ ไม่มี IO) เพื่อให้สลับตัวเลือกแล้วเห็นผลทันที
- ราคามาจาก snapshot ล่าสุดใน DB + เวลาที่อัปเดต แสดงบนหน้าจอเสมอ
- ตัวเชื่อม DB (`src/lib/db/index.ts`) รองรับ 3 แบบ: URL ของ Neon → Neon HTTP, Postgres อื่น → postgres.js, ไม่ตั้ง → PGlite · ตารางสร้างเองตอนเชื่อมต่อครั้งแรก ไม่ต้องรัน migration

## 4. โมเดลข้อมูล (`src/lib/db/schema.ts` + `SCHEMA_SQL`)

- `users` — id, username (ตัวเล็ก ไม่ซ้ำ), display_name, password_hash (bcrypt), role (`owner`/`admin`/`member`), is_active, must_change_password, created_at, last_login_at
- `sessions` — id = sha256 ของ token ใน cookie (ไม่เก็บ token ดิบ), user_id, created_at, expires_at (12 ชม. หรือ 30 วันถ้า "จดจำฉัน"), user_agent
- `login_attempts` — key, count, reset_at · ตัวนับ throttle ล็อกอิน (`pair:`/`ip:`/`user:`/`known:`/`reauth:`), ตัวนับ API สาธารณะ (`pub:`) และตัวนับกันปั่นสถิติ (`track:`/`trackvid…`)
- `market_items` — snapshot ล่าสุดต่อไอเท็ม: id, ชื่อไทย/อังกฤษ, icon, grade, หมวด, price, stock, total_trades, volume_14d, updated_at, history_fetched_at
- `market_daily` — (item_id, day) price, stock, total_trades · ประวัติรายวันของเราเอง + backfill 90 วันจาก API ทางการ
- `market_meta` — key/value: เวลา/แหล่งรีเฟรชล่าสุด, error ล่าสุด, ช่องจองรีเฟรช (auto/manual), ตัวเลขเวลาโหลดหน้าตลาด
- `user_settings` — user_id → JSON ตั้งค่า (VP, Fame, แหวน, โบนัสอื่น, ระดับทักษะ, Mastery, รอบ/ชม., โหมดต้นทุนของในคลัง)
- `user_inventory` — (user_id, item_id) qty, avg_cost
- `user_favorites` — (user_id, item_id) ของที่ปักดาว
- `usage_visitor_days`, `usage_visitors`, `usage_page_views`, `usage_capped_days` — นับคนใช้งาน เก็บแค่ sha256 ของ id เบราว์เซอร์, ชื่อหน้า, วันตามเวลาไทย และเป็นสมาชิกหรือไม่ ไม่เก็บ id ดิบ/IP/ชื่อผู้ใช้/user id

ไม่มีตาราง items/recipes ใน DB: ฐานสูตรเป็นไฟล์ JSON ใน `src/data/` · ตาราง `plans` (แผนกิล) ถูกลบแล้ว · ทุกตารางเปิด RLS และถอนสิทธิ์ `anon`/`authenticated` ของ Supabase → **ตารางใหม่ต้องเพิ่มใน `APP_TABLES`**

## 5. Engine คำนวณ (`src/lib/engine/`)

- `netRate = 0.65 × (1 + vp + fame + ring + โบนัสอื่น)`
- ต้นทุนต่อชิ้น (`CostEngine`):
  - มีในคลัง → ตามโหมดในตั้งค่า: ราคาตลาด (ค่าเสียโอกาส ค่าเริ่มต้น คิดเหมือนไม่มีของ) / ต้นทุน 0 / ราคาที่จ่ายจริงที่บันทึกไว้ (ตัวที่ไม่ได้กรอกใช้ราคาตลาด)
  - ไม่มีในคลัง → ถูกสุดระหว่าง ซื้อตลาด / ทำเอง (ซ้อนได้ถึง 12 ชั้น) · บังคับซื้อ / บังคับทำ ต่อไอเท็มได้ในต้นไม้ต้นทุน
  - ซื้อ NPC ใช้เฉพาะของที่ไม่ขายในตลาดและราคาไม่เกิน 10,000 (ข้อมูลเกมมีราคา NPC ติดทุกไอเท็มแม้ไม่มีร้านขาย)
  - หาราคาไม่ได้ → แสดง "?" (ต้นทุนไม่ครบ) และเรียงไว้ท้ายรายการ
  - วัตถุดิบแบบ "A หรือ B" → เลือกตัวที่รวมแล้วถูกสุดต่อรอบ (ใช้จำนวนเต็ม ปัดขึ้น) โดยให้ตัวที่รู้ราคามาก่อน
- `craftCost = Σ(qty × cost) ÷ ผลผลิตเฉลี่ย` · ผลผลิตเฉลี่ยคิดจาก Mastery ตามตารางเกม (`mastery.ts`) · แปรรูป: Mastery = จำนวนชุดต่อครั้ง
- `profit = price × netRate − cost`, ROI, กำไร/ชิ้น, กำไร/ชม. (รอบ/ชม. กรอกเอง) · กล่องราชวัง = เงินจาก NPC × (1 + โบนัส Mastery) ไม่หักภาษี
- แผนผลิต: จำนวนที่ต้องการ → รอบ → วัตถุดิบทุกชั้น − ของที่มี = ต้องซื้อเพิ่ม · ปุ่ม "ผลิตแล้ว" หักวัตถุดิบออกจากคลังและเพิ่มของที่ได้ (ย้อนกลับได้)
- ฝั่งตลาด (แทน "คะแนนเทรด" ที่วางไว้ตอนแรก): 3 สัญญาณ (ชื่ออยู่ใน `src/lib/market/signals.ts` เกณฑ์อยู่ใน `src/components/market/MarketScanner.tsx`) · "ปกติ" = ราคาเฉลี่ย 90 วัน · นับเฉพาะของที่ซื้อขาย 14 วัน ≥ 50 ชิ้น
  - **เทรดได้กำไร** — ซื้อตอนนี้ ขายที่ราคาปกติ หักภาษีแล้ว ROI ≥ 5% (ต้องมีของขาย)
  - **ของถูก น่าซื้อเก็บ** — ต่ำกว่าปกติ ≥ 10% มีของขาย และคะแนน "โอกาสฟื้น" ≥ 45
  - **น่าขายตอนนี้** — สูงกว่าปกติ ≥ 15%
  - "โอกาสฟื้น" (`evidence.ts`) อ่านจาก ราคาเทียบ 90 วัน, ของค้างขายเพิ่ม/ลดหลายวันติด, กี่วันของจะหมด, ทิศทาง 7 วัน, สภาพคล่อง · ไม่ใช่การพยากรณ์ และไม่รู้อีเวนต์/แพตช์

## 6. หน้าจอ (ตอนนี้)

| หน้า | ทำอะไร |
|---|---|
| `/` หน้าแรก | "ทำอะไรดีตอนนี้" + คุ้มสุดต่อสกิล (แปรธาตุ/ทำอาหาร/แปรรูป/ราชวัง) + ของที่ตลาดขาด + ทำอะไรได้จากของในคลัง + ของที่ฉันเฝ้า + ตั้งค่าครั้งแรก |
| `/recipes` คำนวณสูตร | รายการจัดอันดับ + รายละเอียดสูตรด้านข้างบนจอใหญ่ (ต้นไม้ต้นทุน, กราฟราคา, order book) · แผนผลิต · ส่งออก CSV |
| `/market` สแกนตลาด | "แนะนำวันนี้" 3 สัญญาณ · ตัวเลือก "แสดง" (ทั้งหมด หรือทีละสัญญาณ) · รายการเฉพาะของที่มีซื้อขายใน 14 วันล่าสุด · สมาชิกกดอัปเดตตลาดเองได้ (ห่างกันอย่างน้อย 2 นาที) |
| `/inventory` คลังของ | จำนวน + ต้นทุนที่จ่าย · มูลค่าตลาด · นำเข้า/ส่งออก CSV |
| `/calc` คิดภาษี | ภาษี เงินที่ได้ กำไร/ขาดทุน ราคาเท่าทุน คุ้ม/ไม่คุ้ม เลือกช่องราคาจริงในตลาดได้ |
| `/help` วิธีใช้ | คู่มือสั้นทุกหน้า |
| `/login` `/setup` `/account` | ล็อกอิน · สร้างแอดมินใหญ่คนแรก · เปลี่ยนรหัส/ชื่อ ออกจากระบบทุกเครื่อง |
| `/admin` `/admin/stats` | จัดการสมาชิก อายุฐานสูตร สำรองข้อมูล (แอดมินใหญ่) · สถิติการใช้งาน + CSV (แอดมินทั้ง 2 ระดับ) |

"ตั้งค่าตัวละคร" (VP, Fame, แหวน, ต้นทุนของในคลัง, ระดับทักษะ, Mastery, รอบ/ชม.) เป็นลิ้นชักที่เปิดได้จากหน้าเครื่องมือ (หน้าแรก สูตร ตลาด คลัง คิดภาษี) · ค้นหาด่วน Ctrl+K อยู่ที่แถบด้านบน

## 7. เฟสงาน

| เฟส | ส่งมอบ | สถานะ |
|---|---|---|
| 0 · Setup | Next.js 16 + Tailwind 4 + vitest · สคริปต์ import bdocodex/bdolytics · ตัวดึงราคา (ทางการ → arsha) + cache 5 นาที | ✅ เสร็จ (ตอนนั้นยังไม่มี DB/ล็อกอิน) |
| 1 · Core calc | Engine + 12 tests (ตรงกับ Excel) · จัดอันดับกำไร แปรธาตุ 209 + ทำอาหาร 321 สูตร · รายละเอียดสูตร (ต้นไม้วัตถุดิบ, ราคาย้อนหลัง 90 วัน, order book) · ตั้งค่า (VP/Fame/แหวน/Mastery) · แผนผลิต + "มีอยู่แล้ว" · ตัวกรองขาดตลาด | ✅ |
| 1.5 · ล็อกอิน | บัญชีที่แอดมินสร้าง (bcrypt + DB session) · role admin/member · ปิด/ลบ/รีเซ็ตรหัส · บังคับตั้งรหัสใหม่ครั้งแรก · Drizzle + PGlite (dev) · 7 tests | ✅ (production ใช้ Supabase ตอน deploy) |
| 2 · ตลาด/เทรด | หน้า `/market`: snapshot 10,040 ไอเท็มลง DB (bdolytics → fallback ทางการ), ประวัติรายวัน + backfill 90 วัน, เทียบราคาปกติ/กำไรหลังภาษี/ROI/ปริมาณ 14 วัน/เทรนด์ 7 วัน, กรองหมวด/ปริมาณ/มีของขาย, cron รายวัน · หน้าสูตรใช้ราคาจาก snapshot เดียวกัน · 4 tests | ✅ |
| 3 · แปรรูป + คลัง | สูตรแปรรูป 8 วิธี (หลอม บด ตากแห้ง เขย่า กรอง ตัดฟืน แปรธาตุ/ทำอาหารอย่างง่าย ตัดสูตรหลอมอุปกรณ์ออก) · Mastery แปรรูป = จำนวนชุดต่อครั้ง · ตั้งค่าและคลังของผูกกับบัญชีใน DB (ย้ายจากเบราว์เซอร์อัตโนมัติ) · หน้า `/inventory` · ฐานสูตรโหลดผ่าน `/api/data` (cache ด้วย ETag) | ✅ (ยังไม่ทำ import ไฟล์ Excel โดยตรง) |
| 4 · กิล | แท็บ "ราชวัง" (กล่องอาหาร/แปรธาตุราชวัง 389 กล่อง ราคาส่ง NPC + โบนัส Mastery ไม่หักภาษี) · (ฟีเจอร์แผนกิลทำแล้วแต่ผู้ใช้ให้ถอดออก) · ส่งออก CSV ตารางกำไร · นำเข้า/ส่งออก CSV คลังของ · PWA (manifest + ไอคอน เพิ่มลงหน้าจอมือถือได้) | ✅ |
| 5 · ใช้ง่าย | หน้าแรกแบบการ์ดมีหัวข้อ (คุ้มสุดต่อสกิล / ตลาดขาด) + ตั้งค่าครั้งแรก · โหมดมือถือ (การ์ดแทนตาราง) · สแกนตลาดมี "แนะนำวันนี้" และโหมด ฉันอยากจะ เทรด/ซื้อถูก/ขายแพง · ไอคอนครบทั้งตลาด | ✅ |
| 5.1 · Deploy + เครื่องมือเพิ่ม (2026-09-04) | ขึ้น Vercel + Supabase Postgres (postgres.js รองรับ Postgres ทุกเจ้า) · `/api/health` · ย้าย function ไป `sin1` ใกล้ DB · หน้า `/calc` คิดภาษี · ต้นไม้ต้นทุนแอบดู/บังคับซื้อ-ทำ · "ทำอะไรได้จากของในคลัง" + ปุ่ม "ผลิตแล้ว" · คะแนน "โอกาสฟื้น" · แอดมิน 2 ระดับ (owner/admin) + โอนตำแหน่ง · `scripts/admin-tools.mjs` กู้บัญชี · เปลี่ยนชื่อเว็บเป็น BDO Life by BloodMoon TH · สแกนเฉพาะของที่มีซื้อขายใน 14 วัน | ✅ |
| 5.2 · ใช้สะดวก (2026-09-05, `122ca72` `95b22a6`) | หน้า `/help` · จำตัวกรอง/การเรียงในเบราว์เซอร์ · หัวตารางติดบน · โครงหน้าตอนโหลด · อายุฐานสูตร + สำรองข้อมูล JSON ในหน้า admin · ค้นหาด่วน Ctrl+K · ปักดาว ★ ของที่เฝ้า (`user_favorites`) | ✅ |
| 6 · ความปลอดภัย (2026-10-01, `350071c`) | เปิด RLS ทุกตาราง + ถอนสิทธิ์ `anon`/`authenticated` ของ Supabase ใน `SCHEMA_SQL` · throttle ล็อกอินใน DB (`login_attempts`) · บัญชีรหัสชั่วคราวใช้ได้แค่หน้าเปลี่ยนรหัส · "จดจำฉัน" 30 วัน (ปกติ 12 ชม.) · ออกจากระบบทุกเครื่อง · CSP nonce (`src/proxy.ts`) + security headers (`next.config.ts`) · `/api/health` สาธารณะเหลือ ok/db/commit · cron ไม่ทำงานถ้าไม่มี `CRON_SECRET` บน production | ✅ |
| 7 · ปรับ UI ทั้งเว็บ (2026-10-01..02, `74fd2be`..`5543373`) | ชิ้น UI กลางใน `src/components/ui` · page shell + แถบแท็บล่างบนมือถือ · คิวบันทึก (`src/lib/save-queue.ts`) แจ้งสถานะและลองใหม่ · `ConfirmDialog`/`useConfirm` แทน `confirm()` · Toast · error เป็นภาษาไทยพร้อมปุ่มลองใหม่ · หน้าแรก "ทำอะไรดีตอนนี้" · คิดภาษีบอก คุ้ม/ไม่คุ้ม · ค้นหาด่วนเป็น dialog | ✅ |
| 8 · เปิดสาธารณะ + สถิติ (2026-10-02, `daa5b17`) | ใช้ได้โดยไม่ล็อกอิน (`localStorage` `bls:guest:v1:*`) · ล็อกอินแล้วนำข้อมูลในเครื่องเข้าบัญชีได้ (เฉพาะบัญชีที่ยังว่าง ต้องกดยืนยัน) · จำกัดคำขอ API สาธารณะต่อที่อยู่ · นับผู้ใช้ `UsageBeacon` → `POST /api/track` → ตาราง `usage_*` → `/admin/stats` (+ CSV) | ✅ |
| 9 · ธีม "Adventurer's Ledger" (2026-10-02..04, `1cf2ddf`) | ออกแบบด้วย skill UI UX Pro Max (ของภายนอก) · โทนมืดอุ่น + ทองเก่า · ฟอนต์ Taviraj (หัวข้อ) + Anuphan (เนื้อหา) ผ่าน `next/font` · โลโก้พระจันทร์เสี้ยว (`Emblem`) ของ BloodMoon · ชุดไอคอนของเราเอง (`src/components/ui/Icon.tsx`) · `Divider`, `Avatar`, `table.ts`, `recipe-type-icon.ts` · top bar ติดบน + แถบแท็บล่าง 5 แท็บบนมือถือ · หน้าสูตร = รายการจัดอันดับ + รายละเอียดด้านข้างบนจอใหญ่ · หน้า 404 (`src/app/not-found.tsx`) · แหล่งอ้างอิงหน้าตา: `design-system/bdo-lifeskill-studio/MASTER.md` | ✅ |
| — · ดูแล repo (2026-10-04, `2b89239`) | `.gitignore` ไม่เก็บ `/.claude/skills/` และ `/.agents/` (skill ที่เจ้าของติดตั้งในเครื่องด้วย `npm install -g ui-ux-pro-max-cli` แล้ว `uipro init --ai claude`) · `.claude/launch.json` ยังอยู่ใน git | ✅ |

หมายเหตุการตัดสินใจระหว่างทำ: ล็อกอินเปลี่ยนจาก Discord เป็นบัญชีที่แอดมินสร้างให้ (ผู้ใช้ต้องการควบคุม/ปิดสิทธิ์ได้เอง ไม่มีสมัครเอง) · ผลผลิตเฉลี่ยคิดจาก Mastery ตามตารางเกม (`src/lib/engine/mastery.ts`) · วัตถุดิบทดแทนใช้จำนวนเต็มต่อรอบ (ปัดขึ้น) · การเรียงเริ่มต้นใช้ กำไร/ชิ้น · ผู้ใช้ให้ถอดฟีเจอร์แผนกิลออก (อย่าใส่กลับ) · ผู้ใช้อยากให้ใครก็ใช้ได้โดยไม่ต้องล็อกอิน และอยากรู้ว่ามีคนใช้จริงกี่คน จึงเปิดเว็บพร้อมระบบนับผู้ใช้ (ยังไม่ให้ search engine เก็บ ถ้าจะเปิดต้องถามก่อน)

## 8. สิ่งที่ต้องเตรียมฝั่งผู้ใช้ (ตอนนี้)

- GitHub repo นี้ + Vercel project ที่เชื่อมกับ repo (function รันที่ `sin1` และ cron ตาม `vercel.json`)
- Supabase Postgres (หรือ Postgres เจ้าอื่น) → ตั้ง `DATABASE_URL` ใน Vercel env · Supabase ใช้ connection string แบบ Transaction pooler (port 6543) ตาม `.env.example` · ไม่ต้องรัน migration
- `CRON_SECRET` ใน Vercel env (ไม่ตั้ง → `/api/cron/market` ตอบ 503 บน production)
- แก้ env บน Vercel แล้วต้อง redeploy ถึงจะมีผล
- หลัง deploy ครั้งแรก: เปิด `/setup` สร้าง **แอดมินใหญ่คนแรก** ทันที (เว็บเปิดสาธารณะ ใครเข้าก่อนก็สร้างได้)
- แนะนำปิด Data API ของ Supabase เพราะเว็บไม่ได้ใช้ (ตารางล็อกด้วย RLS อยู่แล้ว)
- เครื่องตัวเอง: `npm install` · `npm run import:data` เมื่อมีแพตช์ใหญ่ · ถ้าไม่ได้ตั้ง `DATABASE_URL` จะใช้ PGlite ใน `.data/pglite`

## 9. ความเสี่ยงและวิธีรับมือ

- arsha ล่มบ่อย / API ทางการตอบ HTML ตอนถูกจำกัด → snapshot ใน DB + fallback หลายชั้น + หยุด backfill ประวัติ 15 นาทีเมื่อถูกจำกัด + บอกบนหน้าว่า "ราคาอัปเดต" เมื่อไหร่
- endpoint ทางการบางตัวบีบอัดแบบเฉพาะ → ให้ arsha ถอด (order book) ถ้าจำเป็นค่อยพอร์ตตัวถอดรหัส
- bdocodex/bdolytics ไม่ใช่ API สาธารณะ → bdocodex import ครั้งเดียว · bdolytics 1 คำขอต่อการรีเฟรช (cron วันละครั้ง + รีเฟรชเบื้องหลังไม่เกิน 1 ครั้ง/15 นาที + สมาชิกกดเองได้ทุก 2 นาที) · ใส่เครดิต
- สูตรมีทางเลือก ("หญ้าป่า หรือ วัชพืช") และผลผลิตขึ้นกับ Mastery → รองรับกลุ่มวัตถุดิบทดแทน + ผลผลิตจากตาราง Mastery
- ตลาด Asia ของหลายตัว stock 0 → ธงสภาพคล่องต้องเด่น ไม่ให้ตัวเลขกำไรหลอก
- Supabase เปิดตาราง public ผ่าน REST API ให้ role `anon`/`authenticated` → RLS + REVOKE ใน `SCHEMA_SQL` ทุกครั้งที่เริ่มระบบ · ตารางใหม่ต้องเพิ่มใน `APP_TABLES`
- postgres.js + transaction pooler: เคยเจอหน้าตลาดค้างจน function timeout เพราะยิง query พร้อมกันเกิน pool (ตอนนั้น `max: 4`) → ตอนนี้ `max: 10` และห้ามมีหน้าไหนยิงพร้อมกันเกิน 10
- เว็บเปิดสาธารณะ → คนไม่ล็อกอินถูกจำกัดคำขอ API ต่อที่อยู่ ได้ราคาจาก snapshot ใน DB เท่านั้น (ยกเว้นยังไม่มี snapshot เลย) บังคับรีเฟรชไม่ได้ และดูรายละเอียดไอเท็มถามต้นทางได้รวมกันไม่เกิน 300 ครั้ง/15 นาที · `/api/track` จำกัดต่อที่อยู่และจำกัดจำนวนผู้ใช้ใหม่ต่อวัน กันปั่นยอดสถิติ

## 10. การตรวจสอบ

- **โค้ด:** `npm test` (vitest — engine ตรงกับตัวอย่างใน Excel สูตร ELX001/ELX003, auth/session, throttle, RLS/schema, rate limit, นับผู้ใช้, ข้อมูล guest, คิวบันทึก ฯลฯ) · `npx tsc --noEmit` · `npm run lint` · `npm run build`
- **QA ในเครื่องโดยไม่แตะ production:** `.env.local` ของเจ้าของชี้ DB production อยู่ (`npm run dev` = ข้อมูลจริง) จึงทดสอบบน PGlite ที่ทิ้งได้:
  ```bash
  DATABASE_URL="" PGLITE_DATA_DIR=.data/pglite-qa npx next build && DATABASE_URL="" PGLITE_DATA_DIR=.data/pglite-qa npx next start -p 3001
  ```
  Next ไม่เอาค่าใน `.env.local` มาทับตัวแปรที่ตั้งไว้แล้ว แม้จะเป็นค่าว่าง · ต้องไม่มี `POSTGRES_URL`/`POSTGRES_PRISMA_URL` ด้วย เพราะโค้ดจะใช้แทน `DATABASE_URL` · ยืนยันว่าเป็น DB ใหม่: เปิด `/setup` แล้วเห็นฟอร์ม "สร้างบัญชีแอดมิน" ไม่ถูกพาไป `/login` (ดูแค่ HTTP 200 ไม่ได้ เพราะ DB ที่มีบัญชีแล้วก็ตอบ 200 แล้วค่อย redirect ใน stream) · เสร็จแล้วปิด server และลบเฉพาะ `.data/pglite-qa` (ห้ามลบ `.data/pglite`)
- **production หลัง deploy:**
  - `/api/health` ตอบ `{"ok":true,"db":"ok","commit":…}` และ `commit` ตรงกับที่ push · header `X-Vercel-Id` ส่วนที่สอง (region ของ function) ต้องเป็น `sin1` เช่น `sin1::sin1::…` ถ้าเป็น `iad1` แปลว่า function ไม่ได้รันที่สิงคโปร์
  - ทุกหน้า (ไม่นับ `/api`) มี `Content-Security-Policy` ที่มี `nonce-…` + `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
  - คนไม่ล็อกอินเปิด `/admin`, `/admin/stats`, `/account` → ถูกพาไป `/login` (ได้ HTTP 200 แล้ว redirect ใน stream ไม่ใช่ 307) และ HTML ไม่มีข้อมูลบัญชี
  - ถ้ายังเปิด Data API ของ Supabase อยู่: ใช้ public (publishable/anon) key ยิง REST API ทุกตาราง ต้องได้ `permission denied` (42501)
  - cron: snapshot ครบ ≥ 9,000 ไอเท็ม (`/api/health` ฝั่งแอดมินบอกอายุ/แหล่ง/จำนวน) · ตรวจราคาสุ่ม 5 ไอเท็มเทียบกับในเกม
- ผลตรวจ production ล่าสุด 2026-10-04 (commit `2b89239`): ผ่านทุกข้อด้านบนยกเว้นข้อ cron/ราคาสุ่มที่ไม่ได้ตรวจรอบนี้

## 11. ไอเดียที่ยังไม่ได้ทำ

- PWA แบบใช้ออฟไลน์ได้ (ตอนนี้มีแค่ manifest + ไอคอน ไม่มี service worker ต้องออนไลน์)
- แจ้งเตือนราคาไป Discord
- นำเข้าคลังจากไฟล์ Excel เดิมโดยตรง (ตอนนี้ต้องบันทึกชีตเป็น CSV ก่อน)
- สูตรผลิตของกิลด์/อาวุธ
- กรอกราคาประเมินเองให้ของที่หาราคาไม่ได้ (engine รองรับ override แบบ `price` แล้ว แต่ยังไม่มีช่องในหน้าเว็บ)
