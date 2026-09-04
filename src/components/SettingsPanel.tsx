"use client";

import type { Settings, SkillGroup } from "@/lib/engine/types";
import { netRate } from "@/lib/engine/cost";
import { imperialBonus, massProcessCount, MASTERY_MAX, maxQuantityChance } from "@/lib/engine/mastery";
import { pct } from "@/lib/format";
import { NumberInput } from "./NumberInput";

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
          {/* header row once, then one aligned row per skill: every cell is label-less so nothing wraps */}
          <div className="grid grid-cols-[4.5rem_1fr_1fr_1fr] gap-2 text-xs text-muted">
            <span />
            <span>ระดับที่มี</span>
            <span>Mastery</span>
            <span>รอบ/ชม.</span>
          </div>
          {SKILLS.map(({ key, label }) => {
            const mastery = settings.mastery[key] ?? 0;
            const hint =
              key === "processing"
                ? `แปรรูปได้ครั้งละ ${massProcessCount(mastery)} ชุด`
                : `โอกาสได้ผลผลิตเต็ม ${pct(maxQuantityChance(key, mastery), 1)} · โบนัสส่งราชวัง +${pct(imperialBonus(mastery))}`;
            const control = "num h-9 w-full rounded border border-border bg-panel-2 px-2 text-sm text-foreground";
            return (
              <div key={key} className="grid grid-cols-[4.5rem_1fr_1fr_1fr] items-start gap-2">
                <span className="pt-2 font-medium">{label}</span>
                <div>
                  <select
                    aria-label={`ระดับ${label}`}
                    value={settings.skillTier[key] ?? 6}
                    onChange={(e) => set({ skillTier: { ...settings.skillTier, [key]: Number(e.target.value) } })}
                    className={control}
                  >
                    {TIERS.map((t, i) => (
                      <option key={t} value={i}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <div className="mt-0.5 min-h-4 text-[11px] text-muted">ซ่อนสูตรที่เกินระดับ</div>
                </div>
                <div>
                  <NumberInput
                    aria-label={`Mastery ${label}`}
                    step={50}
                    min={0}
                    max={MASTERY_MAX}
                    value={mastery}
                    onChange={(v) => set({ mastery: { ...settings.mastery, [key]: v } })}
                    className={control}
                  />
                  <div className="mt-0.5 min-h-4 truncate text-[11px] text-muted" title={hint}>
                    {hint}
                  </div>
                </div>
                <div>
                  <NumberInput
                    aria-label={`รอบต่อชั่วโมง ${label}`}
                    step={50}
                    min={0}
                    value={settings.craftsPerHour[key] ?? 0}
                    onChange={(v) => set({ craftsPerHour: { ...settings.craftsPerHour, [key]: v } })}
                    className={control}
                  />
                  <div className="mt-0.5 min-h-4 text-[11px] text-muted">ใช้คิดกำไร/ชม.</div>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted">
            Mastery คือค่าความชำนาญในเกม (ดูได้ในหน้าต่างทักษะ) · แปรธาตุ/ทำอาหาร: ยิ่งสูง ยิ่งมีโอกาสได้ผลผลิตจำนวนสูงสุดต่อรอบ (เช่น สูตร 1~4 ชิ้น ที่ Mastery 2000
            จะได้เฉลี่ย 3.25 ชิ้น) และได้เงินจากการส่งกล่องราชวังเพิ่ม · แปรรูป: ไม่เพิ่มผลผลิตต่อชุด แต่ทำได้หลายชุดต่อครั้ง ให้ปรับ &ldquo;รอบ/ชม.&rdquo; ตามความเร็วจริงของคุณ
          </p>
        </div>
      </section>
    </div>
  );
}
