"use client";
import { ReactNode, useEffect, useRef } from "react";
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (
      !node ||
      !("IntersectionObserver" in window) ||
      !node.animate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        animation = node.animate(
          [
            { opacity: 0.65, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 450, easing: "cubic-bezier(.2,.75,.25,1)" },
        );
        observer.disconnect();
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
