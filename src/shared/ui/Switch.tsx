"use client";

import { motion } from "framer-motion";
import { cn } from "@/shared/lib/cn";
import { spring } from "./motion";

/** iOS-подобный переключатель. Невидимая зона касания расширена до 44px. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 before:absolute before:-inset-2 disabled:opacity-40",
        checked ? "bg-ink" : "bg-surface-2",
      )}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? 20 : 0 }}
        transition={spring.snappy}
        className={cn(
          "absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.18)]",
          checked ? "bg-on-ink" : "bg-white",
        )}
      />
    </button>
  );
}
