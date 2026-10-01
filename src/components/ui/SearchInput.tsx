"use client";

import { useRef, type InputHTMLAttributes } from "react";
import { fieldCls } from "./field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "className" | "size"> & {
  value: string;
  onChange: (value: string) => void;
  /** what the box searches, read out by screen readers (a placeholder alone is not a label) */
  label: string;
  /** width / layout classes for the box, e.g. "min-w-[200px] flex-1" or "w-52" */
  className?: string;
};

/** Search box: ⌕ in front, a × to clear once there is text, and a "search" key on phone keyboards. */
export function SearchInput({ value, onChange, label, className = "", ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
        ⌕
      </span>
      <input
        {...rest}
        ref={ref}
        type="search"
        enterKeyHint="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldCls()} pl-8 pr-9 [&::-webkit-search-cancel-button]:appearance-none`}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label="ล้างคำค้น"
          title="ล้างคำค้น"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded text-lg leading-none text-muted hover:text-foreground focus-visible:-outline-offset-2"
        >
          ×
        </button>
      )}
    </div>
  );
}
