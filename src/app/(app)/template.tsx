"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { spring } from "@/shared/ui/motion";

/**
 * template.tsx перемонтируется при каждой навигации — пружинное появление экрана.
 * Вложенные экраны (списки) «въезжают» справа, как push в iOS; разделы таб-бара — проявляются.
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDetail = /^\/(lists|smart)\//.test(pathname);
  return (
    <motion.div
      initial={isDetail ? { opacity: 0, x: 32 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={spring.sheet}
    >
      {children}
    </motion.div>
  );
}
