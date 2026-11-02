/**
 * Wording for customer emails and texts. Plain functions of plain strings,
 * so the copy can be checked in tests without a database or providers.
 */

/** A heading as a sentence: a full stop, unless it already ends in one, or a question or exclamation mark. */
export function sentence(text: string) {
  const s = text.trim();
  return /[.?!…]$/.test(s) ? s : s + ".";
}

/**
 * An email heading in the brand's lowercase style: the subject as a sentence,
 * with only its first letter lowered, so names such as Symmetry keep capitals.
 * The subject line itself stays in sentence case.
 */
export function heading(text: string) {
  const s = sentence(text);
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** One trim as the site writes it: "Tue, 10 November 2026 at 9:00". */
export type TrimText = { when: string; service: string; barber: string };

export type PolicyText = {
  hours: number;
  latePercent: number;
  noShowPercent: number;
  /** The exact free-cancellation deadline, when the message is about one trim. */
  deadline?: string;
};

/**
 * The body of a booking message: every trim it is about, one to a line, then
 * the one thing to know or do. The heading (the subject) is not repeated.
 */
export function bookingText(opts: {
  kind: string;
  trims: TrimText[];
  policy?: PolicyText | null;
  lateMinutes?: number;
}) {
  const lines = opts.trims.map(
    (t) => `${t.when}: ${t.service} with ${t.barber}.`,
  );
  const changeable = ["confirmed", "moved", "reminder"].includes(opts.kind);
  if (opts.kind === "running_late")
    lines.push(
      `The shop has been told you expect to be ${opts.lateMinutes} minutes late.`,
    );
  else if (changeable && opts.policy) {
    const p = opts.policy;
    const free =
      opts.trims.length === 1 && p.deadline
        ? `Free cancellation until ${p.deadline}.`
        : p.hours
          ? `Free cancellation up to ${p.hours} hour${p.hours === 1 ? "" : "s"} before each trim.`
          : "Free cancellation until each trim starts.";
    lines.push(
      `${free} Late cancellation: ${p.latePercent}%. No-show: ${p.noShowPercent}%. Move or cancel using your booking link.`,
    );
  } else if (changeable) lines.push("Move or cancel using your booking link.");
  else lines.push("Your booking link has the details.");
  return lines.join("\n");
}

/** A freed time for someone on the waitlist, naming the day when we know it. */
export function waitlistOfferText(day: string | null) {
  return `A time is available on ${day ?? "your requested day"}. Book a trim to reserve it; availability can change.`;
}
