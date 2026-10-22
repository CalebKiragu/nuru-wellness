"use client";

import { motion, useScroll, useSpring } from "motion/react";

/** A hairline reading-progress indicator, fixed to the top of the viewport. */
export function ScrollProgress({ color = "var(--color-brass)" }: { color?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2px] origin-left"
      style={{ scaleX, background: color }}
    />
  );
}
