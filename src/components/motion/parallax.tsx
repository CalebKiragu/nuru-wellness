"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";

/**
 * A restrained scroll parallax for editorial imagery. The wrapper is expected
 * to be positioned (usually absolute inset-[-6%]) around a fill image.
 *
 * Reduced-motion visitors get the neutral transform through a CSS override in
 * globals.css; keeping the motion values mounted avoids hydration differences.
 */
export function Parallax({
  children,
  className,
  distance = 28,
  zoom = false,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  zoom?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.05, 1, 1.05]);

  return (
    <motion.div
      ref={ref}
      className={className}
      data-parallax
      style={zoom ? { y, scale } : { y }}
    >
      {children}
    </motion.div>
  );
}
