# BDO LifeSkill Studio (TH / Asia)

เว็บคำนวณต้นทุน–กำไร–ROI ของสูตร Life Skill ใน Black Desert Online (เซิร์ฟเวอร์ Asia)
จากราคาตลาดกลางแบบสด ต่อยอดจากไฟล์ Excel `BDO_LifeSkill_Studio_v2.0_TH_Asia.xlsx`

แผนงานทั้งหมดอยู่ใน [PLAN.md](PLAN.md)

## เริ่มใช้งาน

```bash
npm install
npm run import:data   # ดึงสูตร/ชื่อไอเท็ม/ไอคอน (ครั้งแรก หรือเมื่อมีแพตช์ใหญ่)
npm run dev           # http://localhost:3000
```

## โครงสร้าง

| ที่ | หน้าที่ |
|---|---|
| `scripts/import-bdocodex.mjs` | นำเข้าสูตรแปรธาตุ/ทำอาหารจาก bdocodex (รวมกลุ่มวัตถุดิบที่ใช้แทนกันได้) และชื่อไอเท็มไทย/อังกฤษจาก bdolytics → `src/data/*.json` + `public/icons/items/` |
| `src/lib/engine/` | engine คำนวณต้นทุนซ้อนชั้น (ซื้อ/ทำเอง/ของในคลัง) กำไร ROI พร้อม unit test (`npm test`) |
| `src/lib/market/` | ตัวดึงราคาตลาด Asia: API ทางการ Pearl Abyss เป็นหลัก, arsha.io เป็น fallback, cache 10 นาที |
| `src/app/api/prices` | `GET /api/prices?ids=all` ราคาปัจจุบันของทุกไอเท็มในฐานสูตร |
| `src/app/api/market/[id]` | ราคาย้อนหลัง 90 วัน + order book ของไอเท็ม |
| `src/components/Studio.tsx` | หน้าหลัก: จัดอันดับกำไร ค้นหา กรอง กดแถวดูรายละเอียดวัตถุดิบและตลาด |

## สูตรที่ใช้

- เงินที่ได้รับจริง = ราคาขาย × 0.65 × (1 + Value Pack 0.30 + Family Fame + แหวนพ่อค้า 0.05)
- ต้นทุนไอเท็ม = ถูกสุดระหว่าง ซื้อตลาด / ซื้อ NPC / ทำเอง (ผลรวมวัตถุดิบ ÷ ผลผลิตเฉลี่ย) โดยเลือกวัตถุดิบทดแทนที่ถูกที่สุดต่อหน่วยให้อัตโนมัติ
- ผลผลิตเฉลี่ย = (min+max)/2 ของสูตร × ตัวคูณผลผลิต (ตั้งค่าตาม mastery ของผู้ใช้)

## เครดิตข้อมูล

ราคาตลาด: Pearl Abyss (Asia) / [arsha.io](https://arsha.io) · สูตร: [bdocodex.com](https://bdocodex.com) · ชื่อไอเท็ม: [bdolytics.com](https://bdolytics.com)
