"use client";

import { useState } from "react";
import { netRate } from "@/lib/engine/cost";
import { imperialBonus, massProcessCount, MASTERY_MAX, maxQuantityChance } from "@/lib/engine/mastery";
import type { Settings, SkillGroup } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import { NET_RATE_LABEL, SETTINGS_TITLE, SKILLS, VALUE_PACK } from "@/lib/settings-labels";
import { NumberInput } from "./NumberInput";
import { btn } from "./ui/button";
import { Card, CardHeader } from "./ui/Card";
import { checkboxCls, fieldCls } from "./ui/field";

/** What the card saves: its own fields only, laid over the settings as they are when saved. */
export type OnboardingPatch = Pick<Settings, "mastery" | "valuePack">;

/**
 * First-visit setup only: the numbers that change every result, nothing else. Later changes go
 * through ตั้งค่าตัวละคร.
 *
 * It keeps only what was typed here. Every field not touched shows (and saves) the current
 * settings, so a change made in the settings drawer while the card is open is neither hidden nor
 * overwritten by a stale copy.
 */
export function OnboardingCard({ settings, onSave, onSkip }: { settings: Settings; onSave: (patch: OnboardingPatch) => void; onSkip: () => void }) {
  const [masteryEdits, setMasteryEdits] = useState<Partial<Record<SkillGroup, number>>>({});
  const [valuePackEdit, setValuePackEdit] = useState<boolean | null>(null);
  const draft: Settings = { ...settings, mastery: { ...settings.mastery, ...masteryEdits }, valuePack: valuePackEdit ?? settings.valuePack };
  const setMastery = (key: SkillGroup, v: number) => setMasteryEdits((m) => ({ ...m, [key]: Math.max(0, Math.min(MASTERY_MAX, v || 0)) }));

  return (
    <Card tone="highlight" className="mb-4">
      <CardHeader
        tone="highlight"
        title="ตั้งค่าครั้งแรก 1 นาที"
        hint={<>ใส่ Mastery ในเกมของคุณ ระบบจะคิดผลผลิต โบนัสราชวัง และภาษีให้ตรงกับตัวคุณ แก้ทีหลังได้ที่ปุ่ม &ldquo;{SETTINGS_TITLE}&rdquo;</>}
      />
      <div className="p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {SKILLS.map(({ key, label }) => {
            const m = draft.mastery[key] ?? 0;
            const hint =
              key === "processing"
                ? `แปรรูปได้ครั้งละ ${massProcessCount(m)} ชุด`
                : `โอกาสได้ผลผลิตเต็ม ${pct(maxQuantityChance(key, m), 0)} · โบนัสส่งราชวัง +${pct(imperialBonus(m), 0)}`;
            return (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Mastery {label}</span>
                <NumberInput
                  min={0}
                  max={MASTERY_MAX}
                  step={50}
                  value={m}
                  onChange={(v) => setMastery(key, v)}
                  className={`${fieldCls()} num`}
                />
                <span className="text-xs text-muted">{hint}</span>
              </label>
            );
          })}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{VALUE_PACK.name}</span>
            <span className="flex min-h-10 items-center gap-2 rounded border border-border bg-panel-2 px-3 md:min-h-9">
              <input type="checkbox" checked={draft.valuePack} onChange={(e) => setValuePackEdit(e.target.checked)} className={checkboxCls} />
              <span>{draft.valuePack ? VALUE_PACK.on : VALUE_PACK.off}</span>
            </span>
            <span className="text-xs text-muted">
              {NET_RATE_LABEL} {pct(netRate(draft), 1)}
            </span>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onSave({ mastery: draft.mastery, valuePack: draft.valuePack })} className={btn("primary")}>
            บันทึกและเริ่มใช้งาน
          </button>
          <button type="button" onClick={onSkip} className={btn("secondary")}>
            ข้ามไปก่อน
          </button>
        </div>
      </div>
    </Card>
  );
}
