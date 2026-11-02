"use client";
import { type ComponentProps, type RefObject, useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Dialogs open now, newest last, so Escape only closes the one on top. */
const open: object[] = [];

/**
 * Sheets, drawers, menus and editors: focus moves in when one opens, Escape
 * closes it, and focus goes back to whatever opened it when it closes.
 */
export function useDialog<T extends HTMLElement>(
  onClose: () => void,
  active = true,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const token = {};
    open.push(token);
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const box = ref.current;
    if (box && !box.contains(document.activeElement)) {
      const first = box.querySelector<HTMLElement>(FOCUSABLE);
      if (first) first.focus({ preventScroll: true });
      else {
        if (!box.hasAttribute("tabindex")) box.tabIndex = -1;
        box.focus({ preventScroll: true });
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || open[open.length - 1] !== token) return;
      event.preventDefault();
      close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const at = open.indexOf(token);
      if (at >= 0) open.splice(at, 1);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active]);
  return ref;
}

/** The top of every editor: what it is about, and a way out. */
export function EditorHead({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="editor-head">
      <p className="editor-title">{title}</p>
      <button
        type="button"
        className="editor-close"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

/**
 * An editor form. On a computer it sits in the page under what it edits; on a
 * phone it rises as a sheet over a dimmed backdrop, and a tap on the backdrop
 * closes it.
 */
export function InlineEditor({
  onClose,
  className,
  children,
  ...form
}: ComponentProps<"form"> & { onClose: () => void }) {
  const ref = useDialog<HTMLFormElement>(onClose);
  return (
    <>
      <div className="editor-backdrop" aria-hidden="true" onClick={onClose} />
      <form
        {...form}
        ref={ref}
        className={`staff-form inline-editor${className ? ` ${className}` : ""}`}
      >
        {children}
      </form>
    </>
  );
}
