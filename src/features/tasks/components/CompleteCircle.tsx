"use client";

import { motion } from "framer-motion";
import { cn } from "@/shared/lib/cn";
import { spring } from "@/shared/ui/motion";

/** Кружок выполнения: при отметке заполняется пружиной, как в Apple Reminders. */
export function CompleteCircle({
  checked,
  onToggle,
  size = 24,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      whileTap={{ scale: 0.85 }}
      transition={spring.snappy}
      className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <span
        style={{ width: size, height: size }}
        className={cn(
          "relative rounded-full border-[1.8px] transition-colors duration-200",
          checked ? "border-fg" : "border-muted",
        )}
      >
        <motion.span
          initial={false}
          animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={spring.snappy}
          className="absolute inset-[3px] rounded-full bg-fg"
        />
      </span>
    </motion.button>
  );
}
