"use client";

import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

/**
 * Число, которое плавно «докручивается» к новому значению пружиной.
 * Текст обновляется через motion value — без ре-рендеров React на каждый кадр.
 * При первом показе считает от нуля.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const spring = useSpring(0, { stiffness: 70, damping: 18, mass: 0.9 });
  const text = useTransform(spring, (v) => format(Math.round(v)));

  useEffect(() => {
    if (reduced) spring.jump(value);
    else spring.set(value);
  }, [value, reduced, spring]);

  return (
    <motion.span className={className} aria-label={format(value)}>
      {text}
    </motion.span>
  );
}
