"use client";
import { useEffect, useState } from "react";

/**
 * One way to say something happened: a red band drops from the top of the
 * screen and goes away by itself. Any component can call toast(); the
 * Toaster in the shell shows them, newest at the bottom, three at most.
 */
export type ToastKind = "ok" | "error";
type Toast = { id: number; text: string; kind: ToastKind };
const EVENT = "symmetry-toast";
let counter = 0;

export function toast(text: string, kind: ToastKind = "ok") {
  if (typeof window === "undefined" || !text) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const timers = new Set<number>();
    const onToast = (event: Event) => {
      const { text, kind } = (event as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++counter;
      setItems((list) => [...list.slice(-2), { id, text, kind }]);
      timers.add(
        window.setTimeout(
          () => setItems((list) => list.filter((t) => t.id !== id)),
          kind === "error" ? 6500 : 3800,
        ),
      );
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast is-${t.kind}`}
          onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
