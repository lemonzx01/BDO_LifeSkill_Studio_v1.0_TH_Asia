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
};

/**
 * Number input that lets the user clear the box while typing. A plain
 * controlled <input value={n}> snaps back to "0" the moment the field is
 * emptied, which makes it impossible to type a new number naturally.
 */
export function NumberInput({ value, onChange, min, max, blankZero = false, onFocus, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null); // null = not editing, show the prop
  const shown = draft !== null ? draft : blankZero && value === 0 ? "" : String(value);
  const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));
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
        if (text === "" || text === "-") {
          onChange(clamp(0));
          return;
        }
        const n = Number(text);
        if (Number.isFinite(n)) onChange(clamp(n));
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
