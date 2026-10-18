"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { cn } from "@/shared/lib/cn";
import { spring } from "./motion";
import { Pressable } from "./Pressable";

/** Сегментированный переключатель с «таблеткой», которая переезжает пружиной. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const pillId = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[18px] bg-surface-2 p-1">
      {options.map(({ value: v, label: text, icon: Icon }) => {
        const active = v === value;
        return (
          <Pressable
            key={String(v)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className="relative flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-1 text-[13px] font-semibold"
          >
            {active && (
              <motion.span
                layoutId={pillId}
                transition={spring.smooth}
                className="absolute inset-0 rounded-[14px] bg-bg shadow-soft"
              />
            )}
            {Icon && <Icon size={16} className={cn("relative shrink-0", active ? "text-fg" : "text-muted")} />}
            <span className={cn("relative truncate", active ? "text-fg" : "text-muted")}>{text}</span>
          </Pressable>
        );
      })}
    </div>
  );
}
