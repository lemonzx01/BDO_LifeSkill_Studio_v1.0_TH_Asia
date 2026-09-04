"use client";

import { useState } from "react";
import { imperialBonus, massProcessCount, MASTERY_MAX, maxQuantityChance } from "@/lib/engine/mastery";
import type { Settings, SkillGroup } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import { NumberInput } from "./NumberInput";

const SKILLS: { key: SkillGroup; label: string }[] = [
  { key: "alchemy", label: "แปรธาตุ" },
  { key: "cooking", label: "ทำอาหาร" },
  { key: "processing", label: "แปรรูป" },
];

/** First-visit setup: the three numbers that change every result, nothing else. */
export function OnboardingCard({ settings, onSave, onSkip }: { settings: Settings; onSave: (s: Settings) => void; onSkip: () => void }) {
  const [draft, setDraft] = useState<Settings>(settings);
  const setMastery = (key: SkillGroup, v: number) => setDraft({ ...draft, mastery: { ...draft.mastery, [key]: Math.max(0, Math.min(MASTERY_MAX, v || 0)) } });

  return (
    <section className="mb-4 rounded-lg border border-accent/50 bg-accent/5 p-4">
      <h2 className="text-base font-semibold text-accent">ตั้งค่าครั้งแรก 1 นาที</h2>
      <p className="mt-1 text-sm text-muted">ใส่ Mastery ในเกมของคุณ ระบบจะคิดผลผลิต โบนัสราชวัง และภาษีให้ตรงกับตัวคุณ แก้ทีหลังได้ที่ปุ่ม &ldquo;ตั้งค่า&rdquo;</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
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
                className="num rounded border border-border bg-panel-2 px-3 py-2 text-base outline-none focus:border-accent"
              />
              <span className="text-[11px] text-muted">{hint}</span>
            </label>
          );
        })}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Value Pack</span>
          <span className="flex items-center gap-2 rounded border border-border bg-panel-2 px-3 py-2">
            <input type="checkbox" checked={draft.valuePack} onChange={(e) => setDraft({ ...draft, valuePack: e.target.checked })} className="h-5 w-5 accent-accent" />
            <span>{draft.valuePack ? "มี (ได้รับ 84.5%)" : "ไม่มี (ได้รับ 65%)"}</span>
          </span>
          <span className="text-[11px] text-muted">ภาษีตลาดกลางหลังหัก</span>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onSave(draft)} className="rounded bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300">
          บันทึกและเริ่มใช้งาน
        </button>
        <button onClick={onSkip} className="rounded border border-border bg-panel px-4 py-2 text-sm hover:bg-panel-2">
          ข้ามไปก่อน
        </button>
      </div>
    </section>
  );
}
