"use client";

import type { Settings, SkillGroup } from "@/lib/engine/types";
import { netRate } from "@/lib/engine/cost";
import { massProcessCount, MASTERY_MAX, maxQuantityChance } from "@/lib/engine/mastery";
import { pct } from "@/lib/format";

const TIERS = ["มือใหม่", "ฝึกฝน", "คล่องแคล่ว", "เชี่ยวชาญ", "ช่าง", "ลือชื่อ", "เซียน"];
const SKILLS: { key: SkillGroup; label: string }[] = [
  { key: "alchemy", label: "แปรธาตุ" },
  { key: "cooking", label: "ทำอาหาร" },
  { key: "processing", label: "แปรรูป" },
];

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const rate = netRate(settings);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border border-border bg-panel p-4">
        <h3 className="mb-3 text-sm font-semibold text-accent">รายรับจากตลาด</h3>
        <div className="space-y-2 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span>Value Pack (+30%)</span>
            <input type="checkbox" checked={settings.valuePack} onChange={(e) => set({ valuePack: e.target.checked })} className="h-4 w-4 accent-accent" />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Family Fame</span>
            <select value={settings.familyFame} onChange={(e) => set({ familyFame: Number(e.target.value) })} className="rounded border border-border bg-panel-2 px-2 py-1">
              <option value={0}>ไม่มี</option>
              <option value={0.005}>+0.5% (1,000–3,999)</option>
              <option value={0.01}>+1% (4,000–6,999)</option>
              <option value={0.015}>+1.5% (7,000+)</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>แหวนพ่อค้าผู้มั่งคั่ง (+5%)</span>
            <input type="checkbox" checked={settings.merchantRing} onChange={(e) => set({ merchantRing: e.target.checked })} className="h-4 w-4 accent-accent" />
          </label>
          <div className="flex items-center justify-between border-t border-border pt-2 text-muted">
            <span>ได้รับจริงหลังภาษี</span>
            <span className="num font-semibold text-foreground">{pct(rate, 2)}</span>
          </div>
          <label className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <span>ของที่มีอยู่แล้ว คิดต้นทุน</span>
            <select
              value={settings.ownedCostMode}
              onChange={(e) => set({ ownedCostMode: e.target.value as Settings["ownedCostMode"] })}
              className="rounded border border-border bg-panel-2 px-2 py-1"
            >
              <option value="market">ตามราคาตลาด (ค่าเสียโอกาส)</option>
              <option value="zero">0 (ได้มาฟรี/เก็บเอง)</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <h3 className="mb-3 text-sm font-semibold text-accent">ทักษะและผลผลิต</h3>
        <div className="space-y-3 text-sm">
          {SKILLS.map(({ key, label }) => {
            const mastery = settings.mastery[key] ?? 0;
            const hint = key === "processing" ? `ทำได้ครั้งละ ${massProcessCount(mastery)} ชุด` : `โอกาสได้เต็ม ${pct(maxQuantityChance(key, mastery), 1)}`;
            return (
              <div key={key} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2">
                <span className="w-16 font-medium">{label}</span>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  ระดับที่มี
                  <select
                    value={settings.skillTier[key] ?? 6}
                    onChange={(e) => set({ skillTier: { ...settings.skillTier, [key]: Number(e.target.value) } })}
                    className="rounded border border-border bg-panel-2 px-2 py-1 text-sm text-foreground"
                  >
                    {TIERS.map((t, i) => (
                      <option key={t} value={i}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Mastery ({hint})
                  <input
                    type="number"
                    step="50"
                    min="0"
                    max={MASTERY_MAX}
                    value={mastery}
                    onChange={(e) => set({ mastery: { ...settings.mastery, [key]: Math.max(0, Math.min(MASTERY_MAX, Number(e.target.value) || 0)) } })}
                    className="num w-full rounded border border-border bg-panel-2 px-2 py-1 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  รอบ/ชม.
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={settings.craftsPerHour[key] ?? 0}
                    onChange={(e) => set({ craftsPerHour: { ...settings.craftsPerHour, [key]: Number(e.target.value) || 0 } })}
                    className="num w-full rounded border border-border bg-panel-2 px-2 py-1 text-sm text-foreground"
                  />
                </label>
              </div>
            );
          })}
          <p className="text-xs text-muted">
            แปรธาตุ/ทำอาหาร: Mastery เพิ่มโอกาสได้ผลผลิตเต็มต่อรอบ (เช่น สูตร 1~4 ที่ Mastery 2000 แปรธาตุได้เฉลี่ย 3.25 ชิ้น) · แปรรูป: Mastery
            ไม่เพิ่มผลผลิตต่อชุด แต่ทำได้หลายชุดต่อครั้ง ให้ปรับ &ldquo;รอบ/ชม.&rdquo; ตามความเร็วจริงของคุณ
          </p>
        </div>
      </section>
    </div>
  );
}
