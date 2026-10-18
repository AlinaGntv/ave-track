"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";
import type { ComponentProps } from "react";
import { spring } from "./motion";

const MotionLink = motion.create(Link);
const TAP = { scale: 0.96 };

/** Кнопка с мгновенной реакцией на нажатие (лёгкое scale-down). */
export function Pressable({ type = "button", ...props }: HTMLMotionProps<"button">) {
  return <motion.button type={type} whileTap={TAP} transition={spring.snappy} {...props} />;
}

export function PressableLink(props: ComponentProps<typeof MotionLink>) {
  return <MotionLink whileTap={TAP} transition={spring.snappy} {...props} />;
}
