import { clock } from "@/lib/booking-data";

/**
 * Press and hold a trim, then drag it to a new time or column. On a phone a
 * short hold starts the drag so ordinary scrolling still works; with a mouse
 * the drag starts as soon as the pointer moves. The card follows the finger,
 * a dashed outline shows where it will land, and a label shows the new time.
 */
export type DragColumn = { key: string; el: HTMLElement };
export type DragDrop = {
  id: string;
  version: string;
  column: string;
  minute: number;
  duration: number;
};
export type DragOptions = {
  start: number;
  end: number;
  rows: number;
  columns: () => DragColumn[];
  canDrag: (card: HTMLElement) => boolean;
  onDrop: (drop: DragDrop) => void;
};

const STEP = 15;
const HOLD_MS = 320;
const SCROLL_EDGE = 90;

export function attachDrag(container: HTMLElement, opts: DragOptions) {
  let timer: number | null = null;
  let pressed: { card: HTMLElement; x: number; y: number } | null = null;
  let suppressClickUntil = 0;
  let drag: {
    card: HTMLElement;
    id: string;
    version: string;
    duration: number;
    startX: number;
    startY: number;
    grab: number;
    fromColumn: string;
    fromMinute: number;
    column: string;
    minute: number;
    ghost: HTMLElement;
    label: HTMLElement;
  } | null = null;

  const cardAt = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.(
      ".trim",
    ) as HTMLElement | null;
    if (!el || !container.contains(el) || !opts.canDrag(el)) return null;
    return el;
  };

  function begin(card: HTMLElement, x: number, y: number) {
    const column = card.closest(".chair-day") as HTMLElement | null;
    if (!column?.dataset.key) return;
    const rect = card.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "drop-ghost";
    ghost.style.height = card.style.height;
    const label = document.createElement("div");
    label.className = "drag-label";
    drag = {
      card,
      id: card.dataset.id ?? "",
      version: card.dataset.version ?? "",
      duration: Number(card.dataset.duration) || STEP,
      startX: x,
      startY: y,
      grab: y - rect.top,
      fromColumn: column.dataset.key,
      fromMinute: Number(card.dataset.start),
      column: column.dataset.key,
      minute: Number(card.dataset.start),
      ghost,
      label,
    };
    card.classList.add("is-dragging");
    container.classList.add("is-drag-active");
    column.appendChild(ghost);
    document.body.appendChild(label);
    try {
      navigator.vibrate?.(10);
    } catch {}
    update(x, y);
  }

  function update(x: number, y: number) {
    if (!drag) return;
    const columns = opts.columns();
    let best: DragColumn | null = null;
    let bestDistance = Infinity;
    for (const column of columns) {
      const r = column.el.getBoundingClientRect();
      const distance =
        x >= r.left && x <= r.right
          ? 0
          : Math.min(Math.abs(x - r.left), Math.abs(x - r.right));
      if (distance < bestDistance) {
        best = column;
        bestDistance = distance;
      }
    }
    if (!best) return;
    const r = best.el.getBoundingClientRect();
    const rowPx = r.height / opts.rows;
    const raw = opts.start + Math.round((y - drag.grab - r.top) / rowPx) * STEP;
    const minute = Math.max(
      opts.start,
      Math.min(opts.end - drag.duration, raw),
    );
    if (drag.ghost.parentElement !== best.el) best.el.appendChild(drag.ghost);
    drag.ghost.style.top = `${((minute - opts.start) / STEP) * rowPx}px`;
    drag.column = best.key;
    drag.minute = minute;
    drag.card.style.transform = `translate(${x - drag.startX}px, ${y - drag.startY}px)`;
    drag.label.textContent = `${clock(minute)} to ${clock(minute + drag.duration)}`;
    drag.label.style.left = `${Math.min(x + 14, window.innerWidth - 150)}px`;
    drag.label.style.top = `${Math.max(8, y - 40)}px`;
    if (y < SCROLL_EDGE) window.scrollBy(0, -10);
    else if (y > window.innerHeight - SCROLL_EDGE) window.scrollBy(0, 10);
  }

  function finish(drop: boolean) {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pressed = null;
    if (!drag) return;
    const d = drag;
    drag = null;
    d.card.classList.remove("is-dragging");
    d.card.style.transform = "";
    container.classList.remove("is-drag-active");
    d.ghost.remove();
    d.label.remove();
    suppressClickUntil = performance.now() + 500;
    if (drop && (d.column !== d.fromColumn || d.minute !== d.fromMinute))
      opts.onDrop({
        id: d.id,
        version: d.version,
        column: d.column,
        minute: d.minute,
        duration: d.duration,
      });
  }

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const card = cardAt(event.target);
    if (!card) return;
    const t = event.touches[0];
    pressed = { card, x: t.clientX, y: t.clientY };
    timer = window.setTimeout(() => {
      timer = null;
      if (pressed) begin(pressed.card, pressed.x, pressed.y);
    }, HOLD_MS);
  };
  const onTouchMove = (event: TouchEvent) => {
    const t = event.touches[0];
    if (!t) return;
    if (drag) {
      event.preventDefault();
      update(t.clientX, t.clientY);
      return;
    }
    // Moved before the hold finished: the finger is scrolling, not dragging.
    if (
      pressed &&
      Math.hypot(t.clientX - pressed.x, t.clientY - pressed.y) > 8
    ) {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pressed = null;
    }
  };
  const onTouchEnd = () => finish(true);
  const onTouchCancel = () => finish(false);

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const card = cardAt(event.target);
    if (!card) return;
    pressed = { card, x: event.clientX, y: event.clientY };
  };
  const onMouseMove = (event: MouseEvent) => {
    if (drag) {
      event.preventDefault();
      update(event.clientX, event.clientY);
      return;
    }
    if (
      pressed &&
      Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 6
    ) {
      const p = pressed;
      pressed = null;
      begin(p.card, event.clientX, event.clientY);
    }
  };
  const onMouseUp = () => finish(true);
  const onClick = (event: MouseEvent) => {
    if (performance.now() < suppressClickUntil) {
      event.stopPropagation();
      event.preventDefault();
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") finish(false);
  };

  container.addEventListener("touchstart", onTouchStart, { passive: true });
  container.addEventListener("touchmove", onTouchMove, { passive: false });
  container.addEventListener("touchend", onTouchEnd);
  container.addEventListener("touchcancel", onTouchCancel);
  container.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("keydown", onKey);
  container.addEventListener("click", onClick, true);
  return () => {
    finish(false);
    container.removeEventListener("touchstart", onTouchStart);
    container.removeEventListener("touchmove", onTouchMove);
    container.removeEventListener("touchend", onTouchEnd);
    container.removeEventListener("touchcancel", onTouchCancel);
    container.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("keydown", onKey);
    container.removeEventListener("click", onClick, true);
  };
}
