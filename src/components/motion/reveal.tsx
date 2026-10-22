"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  y?: number;
  blur?: boolean;
};

/**
 * A small, accessible entrance animation used across the public storefront and
 * platform pages.
 *
 * It deliberately renders the same markup on the server and the client (hidden
 * until an IntersectionObserver marks it visible) so hydration is deterministic.
 * Visitors who ask for reduced motion get the final state immediately via the
 * media query in globals.css, and a noscript rule in the root layout keeps the
 * content visible when JavaScript has not run.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.8,
  y = 22,
  blur = false,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      ref={ref}
      className={className}
      data-reveal
      data-revealed={shown ? "true" : undefined}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translate3d(0, 0, 0)" : `translate3d(0, ${y}px, 0)`,
        filter: blur && !shown ? "blur(8px)" : "blur(0px)",
        transition: `opacity ${duration}s ${easing} ${delay}s, transform ${duration}s ${easing} ${delay}s, filter ${duration}s ${easing} ${delay}s`,
        willChange: shown ? undefined : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
