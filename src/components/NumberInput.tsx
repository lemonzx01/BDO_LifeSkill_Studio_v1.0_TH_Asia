"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (v: number) => void;
  /** clamp applied when committing */
  min?: number;
  max?: number;
  /** show an empty box instead of 0 */
  blankZero?: boolean;
  /**
   * only report the value when the field is left (blur / Enter) instead of on
   * every keystroke — for fields where an intermediate 0 has side effects
   * (e.g. an inventory row that is removed at quantity 0)
   */
  commitOnBlur?: boolean;
};

/**
 * Number input that lets the user clear the box while typing. A plain
 * controlled <input value={n}> snaps back to "0" the moment the field is
 * emptied, which makes it impossible to type a new number naturally.
 */
export function NumberInput({ value, onChange, min, max, blankZero = false, commitOnBlur = false, onFocus, onBlur, onKeyDown, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null); // null = not editing, show the prop
  const shown = draft !== null ? draft : blankZero && value === 0 ? "" : String(value);
  const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));
  const parse = (text: string): number | null => {
    if (text === "" || text === "-") return clamp(0);
    const n = Number(text);
    return Number.isFinite(n) ? clamp(n) : null;
  };
  const commit = (text: string) => {
    const n = parse(text);
    if (n !== null && n !== value) onChange(n);
  };
  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={shown}
      onFocus={(e) => {
        setDraft(blankZero && value === 0 ? "" : String(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        if (!commitOnBlur) commit(text);
      }}
      onKeyDown={(e) => {
        if (commitOnBlur && e.key === "Enter") {
          commit((e.target as HTMLInputElement).value);
          (e.target as HTMLInputElement).blur();
        }
        onKeyDown?.(e);
      }}
      onBlur={(e) => {
        if (commitOnBlur) commit(e.target.value);
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
