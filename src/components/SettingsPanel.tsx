"use client";

import { useId } from "react";
import type { Settings } from "@/lib/engine/types";
import { netRate } from "@/lib/engine/cost";
import { imperialBonus, massProcessCount, MASTERY_MAX, maxQuantityChance } from "@/lib/engine/mastery";
import { pct } from "@/lib/format";
import {
  FAMILY_FAME,
  FAMILY_FAME_OPTIONS,
  MERCHANT_RING,
  NET_RATE_LABEL,
  OWNED_COST,
  OWNED_COST_OPTIONS,
  SKILL_TIERS,
  SKILLS,
  VALUE_PACK,
} from "@/lib/settings-labels";
import { NumberInput } from "./NumberInput";
import { Card, CardHeader } from "./ui/Card";
import { checkboxCls, fieldCls, selectCls, selectTightCls } from "./ui/field";

/**
 * Every character setting, in one column (it lives in SettingsDrawer). The skills are a table
 * from sm up (one header row, one row per skill); below sm each skill is its own small card with a
 * label over every field, so nothing is clipped on a 375px phone.
 */
export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const rate = netRate(settings);
  const costId = useId();
  const costHint = OWNED_COST_OPTIONS.find((o) => o.value === settings.ownedCostMode)?.hint;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader as="h3" icon="coins" title="รายรับจากตลาด" />
        <div className="space-y-2 p-4 text-sm">
          <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3">
            <span>{VALUE_PACK.checkbox}</span>
            <input type="checkbox" checked={settings.valuePack} onChange={(e) => set({ valuePack: e.target.checked })} className={checkboxCls} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>{FAMILY_FAME}</span>
            <select value={settings.familyFame} onChange={(e) => set({ familyFame: Number(e.target.value) })} className={selectCls()}>
              {FAMILY_FAME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3">
            <span>{MERCHANT_RING.checkbox}</span>
            <input type="checkbox" checked={settings.merchantRing} onChange={(e) => set({ merchantRing: e.target.checked })} className={checkboxCls} />
          </label>
          <div className="flex items-center justify-between rounded-lg bg-panel-2/60 px-3 py-2 text-muted">
            <span>{NET_RATE_LABEL}</span>
            <span className="num text-base font-semibold text-foreground">{pct(rate, 2)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader as="h3" icon="package" title="ต้นทุนของในคลัง" />
        <div className="space-y-1.5 p-4 text-sm">
          <label htmlFor={costId} className="block font-medium">
            {OWNED_COST}
          </label>
          <select
            id={costId}
            value={settings.ownedCostMode}
            onChange={(e) => set({ ownedCostMode: e.target.value as Settings["ownedCostMode"] })}
            aria-describedby={`${costId}-hint`}
            className={`${selectCls()} w-full`}
          >
            {OWNED_COST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p id={`${costId}-hint`} className="text-xs text-muted">
            {costHint}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader as="h3" icon="sliders" title="ทักษะและผลผลิต" />
        <div className="space-y-3 p-4 text-sm sm:space-y-2">
          {/* sm and up: one header row for the table below (each field also has its own hidden label) */}
          <div aria-hidden className="hidden grid-cols-[4.5rem_1fr_1fr_1fr] gap-2 border-b border-border pb-1.5 text-xs font-medium text-muted sm:grid">
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
            return (
              <section
                key={key}
                aria-label={label}
                className="rounded-xl border border-border bg-panel-2/40 p-3 sm:grid sm:grid-cols-[4.5rem_1fr_1fr_1fr] sm:items-start sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
              >
                <h4 className="mb-2 font-medium sm:mb-0 sm:pt-2">{label}</h4>
                {/* phones: tier on its own line, then Mastery and รอบ/ชม. side by side; sm and up: three table cells */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:contents">
                  <label className="col-span-2 block sm:col-span-1">
                    <span className="mb-1 block text-xs text-muted sm:sr-only">
                      ระดับ<span className="sr-only">{label}</span>
                    </span>
                    <select
                      value={settings.skillTier[key] ?? 6}
                      onChange={(e) => set({ skillTier: { ...settings.skillTier, [key]: Number(e.target.value) } })}
                      className={`${selectTightCls()} w-full`}
                    >
                      {SKILL_TIERS.map((t, i) => (
                        <option key={t} value={i}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <span className="mt-0.5 block min-h-4 text-xs text-muted">ซ่อนสูตรที่เกินระดับ</span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted sm:sr-only">
                      Mastery<span className="sr-only"> {label}</span>
                    </span>
                    <NumberInput
                      step={50}
                      min={0}
                      max={MASTERY_MAX}
                      value={mastery}
                      onChange={(v) => set({ mastery: { ...settings.mastery, [key]: v } })}
                      className={`${fieldCls()} num`}
                    />
                    <span className="num mt-0.5 line-clamp-2 min-h-4 text-xs text-muted max-sm:hidden" title={hint}>
                      {hint}
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted sm:sr-only">
                      รอบ/ชม.<span className="sr-only"> {label}</span>
                    </span>
                    <NumberInput
                      step={50}
                      min={0}
                      value={settings.craftsPerHour[key] ?? 0}
                      onChange={(v) => set({ craftsPerHour: { ...settings.craftsPerHour, [key]: v } })}
                      className={`${fieldCls()} num`}
                    />
                    <span className="mt-0.5 block min-h-4 text-xs text-muted">ใช้คิดกำไร/ชม.</span>
                  </label>
                </div>
                {/* phones: the Mastery hint across the whole card */}
                <p className="num mt-2 text-xs text-muted sm:hidden">{hint}</p>
              </section>
            );
          })}
          <p className="border-t border-border pt-3 text-xs text-muted">
            Mastery คือค่าความชำนาญในเกม (ดูได้ในหน้าต่างทักษะ) · แปรธาตุ/ทำอาหาร: ยิ่งสูง ยิ่งมีโอกาสได้ผลผลิตจำนวนสูงสุดต่อรอบ (เช่น สูตร 1~4 ชิ้น ที่ Mastery 2000
            จะได้เฉลี่ย 3.25 ชิ้น) และได้เงินจากการส่งกล่องราชวังเพิ่ม · แปรรูป: ไม่เพิ่มผลผลิตต่อชุด แต่ทำได้หลายชุดต่อครั้ง ให้ปรับ &ldquo;รอบ/ชม.&rdquo; ตามความเร็วจริงของคุณ
          </p>
        </div>
      </Card>
    </div>
  );
}
