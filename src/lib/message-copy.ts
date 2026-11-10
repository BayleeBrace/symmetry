/**
 * Wording for customer emails and texts. Plain functions of plain strings,
 * so the copy can be checked in tests without a database or providers.
 */

/** A heading as a sentence: a full stop, unless it already ends in one, or a question or exclamation mark. */
export function sentence(text: string) {
  const s = text.trim();
  return /[.?!…]$/.test(s) ? s : s + ".";
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

/** One trim as a text writes it: "Sat 14 Nov", "11:45". */
export type SmsTrim = {
  date: string;
  time: string;
  service: string;
  barber: string;
};

/** "Sat 14 Nov" from a YYYY-MM-DD date. */
export function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

/**
 * Plain GSM characters only. One curly apostrophe makes a phone network send
 * the whole text as Unicode, at 70 characters a part instead of 160.
 */
export function gsm(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

/** A link as a text shows it: phones make "symmetrywales.com/..." tappable without the https://. */
export function bareLink(url: string) {
  return url.replace(/^https?:\/\//, "");
}

/** The most a single text part holds in plain GSM characters. */
export const SMS_PART = 160;

/**
 * A booking text that fits in one part (160 characters): when, with whom, the
 * service, and the short booking link. The email carries the cancellation
 * policy in full. If a long service name would spill into a second paid
 * part, the service goes first, then the barber.
 */
export function smsText(opts: {
  kind: string;
  trims: SmsTrim[];
  link: string;
  lateMinutes?: number | null;
  minutes?: number;
}) {
  const [t] = opts.trims;
  const link = bareLink(opts.link);
  const when = t ? `${t.date} at ${t.time}` : "";
  const write = (withBarber: boolean, withService: boolean) => {
    const who = t && withBarber ? ` with ${t.barber}` : "";
    const what = t && withService ? ` ${t.service}.` : "";
    switch (opts.kind) {
      case "confirmed":
        return opts.trims.length > 1
          ? `Symmetry: ${opts.trims.length} trims booked, the first on ${when}${who}. Details: ${link}`
          : `Symmetry: booked for ${when}${who}.${what} Change or cancel: ${link}`;
      case "reminder":
        return `Symmetry reminder: ${when}${who}.${what} Change or cancel: ${link}`;
      case "moved":
        return `Symmetry: your trim has moved to ${when}${who}.${what} Details: ${link}`;
      case "cancelled":
        return `Symmetry: your trim on ${when}${who} is cancelled. Details: ${link}`;
      case "no_show":
        return `Symmetry: we missed you for your trim on ${when}${who}. Details: ${link}`;
      case "running_late":
        return `Symmetry: thanks, the shop knows you'll be ${opts.lateMinutes ? `about ${opts.lateMinutes} min ` : ""}late. Details: ${link}`;
      case "delayed":
        return `Symmetry: ${t?.barber ?? "Your barber"} is running about ${opts.minutes} min behind for your ${t?.time ?? ""} trim today. No need to do anything.`;
      default:
        return `Symmetry: there's an update to your booking. Details: ${link}`;
    }
  };
  const texts = [
    write(true, true),
    write(true, false),
    write(false, false),
  ].map(gsm);
  return texts.find((text) => text.length <= SMS_PART) ?? texts.at(-1)!;
}

/** A freed time for someone on the waitlist, as a one-part text. */
export function smsWaitlistText(day: string | null, url: string) {
  const on = day ?? "the day you asked for";
  const full = gsm(
    `Symmetry: a time is free on ${on}. Book it before it goes: ${bareLink(url)}`,
  );
  return full.length <= SMS_PART
    ? full
    : gsm(`Symmetry: a time is free on ${on}. Book: ${bareLink(url)}`);
}
