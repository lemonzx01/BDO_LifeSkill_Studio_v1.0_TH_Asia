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
import { checkboxCls, fieldCls, labelCls } from "./ui/field";

/** What the card saves: its own fields only, laid over the settings as they are when saved. */
export type OnboardingPatch = Pick<Settings, "mastery" | "valuePack">;

/**
 * First-visit setup only: the numbers that change every result, nothing else. Later changes go
 * through ตั้งค่าตัวละคร.
 *
 * It keeps only what was typed here. Every field not touched shows (and saves) the current
 * settings, so a change made in the settings drawer while the card is open is neither hidden nor
 * overwritten by a stale copy.
 *
 * A plain card under the home page's picks (the gold card there is the answer); its save button is
 * the page's one primary action while it is shown.
 */
export function OnboardingCard({ settings, onSave, onSkip }: { settings: Settings; onSave: (patch: OnboardingPatch) => void; onSkip: () => void }) {
  const [masteryEdits, setMasteryEdits] = useState<Partial<Record<SkillGroup, number>>>({});
  const [valuePackEdit, setValuePackEdit] = useState<boolean | null>(null);
  const draft: Settings = { ...settings, mastery: { ...settings.mastery, ...masteryEdits }, valuePack: valuePackEdit ?? settings.valuePack };
  const setMastery = (key: SkillGroup, v: number) => setMasteryEdits((m) => ({ ...m, [key]: Math.max(0, Math.min(MASTERY_MAX, v || 0)) }));

  return (
    <Card>
      <CardHeader
        icon="sliders"
        title="ตั้งค่าครั้งแรก 1 นาที"
        hint={<>ใส่ Mastery ในเกมของคุณ ระบบจะคิดผลผลิต โบนัสราชวัง และภาษีให้ตรงกับตัวคุณ แก้ทีหลังได้ที่ปุ่ม &ldquo;{SETTINGS_TITLE}&rdquo;</>}
      />
      <div className="p-4">
        {/* two across on a small screen, so each skill's hint has room; four across from lg */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SKILLS.map(({ key, label }) => {
            const m = draft.mastery[key] ?? 0;
            const hint =
              key === "processing"
                ? `แปรรูปได้ครั้งละ ${massProcessCount(m)} ชุด`
                : `โอกาสได้ผลผลิตเต็ม ${pct(maxQuantityChance(key, m), 0)} · โบนัสส่งราชวัง +${pct(imperialBonus(m), 0)}`;
            // font-normal on the hint: it would take on the label's medium weight (fields carry their own)
            return (
              <label key={key} className={labelCls}>
                <span>Mastery {label}</span>
                <NumberInput min={0} max={MASTERY_MAX} step={50} value={m} onChange={(v) => setMastery(key, v)} className={fieldCls()} />
                <span className="num font-normal">{hint}</span>
              </label>
            );
          })}
          <label className={labelCls}>
            <span>{VALUE_PACK.name}</span>
            {/* the checkbox in a box the height of the fields beside it, so the row lines up */}
            <span className="flex min-h-10 items-center gap-2.5 rounded-lg border border-border-field bg-panel-2 px-3 text-base font-normal text-foreground transition-colors duration-150 hover:border-muted/70 md:min-h-9 md:text-sm">
              <input type="checkbox" checked={draft.valuePack} onChange={(e) => setValuePackEdit(e.target.checked)} className={checkboxCls} />
              <span>{draft.valuePack ? VALUE_PACK.on : VALUE_PACK.off}</span>
            </span>
            <span className="num font-normal">
              {NET_RATE_LABEL} {pct(netRate(draft), 1)}
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <button type="button" onClick={() => onSave({ mastery: draft.mastery, valuePack: draft.valuePack })} className={btn("primary")}>
            บันทึกและเริ่มใช้งาน
          </button>
          <button type="button" onClick={onSkip} className={btn("ghost")}>
            ข้ามไปก่อน
          </button>
        </div>
      </div>
    </Card>
  );
}
