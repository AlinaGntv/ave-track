"use client";

import { Minus, Plus } from "lucide-react";
import { Pressable } from "./Pressable";

/** Числовой степпер «− N +» с тап-зонами 44px. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="flex items-center rounded-full bg-bg" role="group" aria-label={label}>
      <Pressable
        aria-label="Меньше"
        disabled={value <= min}
        onClick={() => set(value - 1)}
        className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
      >
        <Minus size={16} />
      </Pressable>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && set(Number(e.target.value))}
        aria-label={label}
        className="w-10 [appearance:textfield] bg-transparent text-center font-bold tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <Pressable
        aria-label="Больше"
        disabled={value >= max}
        onClick={() => set(value + 1)}
        className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
      >
        <Plus size={16} />
      </Pressable>
    </div>
  );
}
