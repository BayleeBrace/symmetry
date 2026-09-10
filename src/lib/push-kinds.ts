/**
 * The push notifications staff can get on their phones, with the wording the
 * test button uses. Shared by the server (what to send) and the settings
 * screen (what to switch on or off). No customer names ever go in a push:
 * they show on the lock screen.
 */
export type PushKind =
  | "new_booking"
  | "cancelled"
  | "moved"
  | "running_late"
  | "added_by_team"
  | "day_ahead"
  | "overdue";

export type PushMessage = {
  kind: PushKind;
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export const PUSH_KINDS: {
  id: PushKind;
  label: string;
  detail: string;
  sample: { title: string; body: string };
}[] = [
  {
    id: "new_booking",
    label: "New online booking",
    detail:
      "Someone books on the website. Owners hear about every chair; barbers about their own.",
    sample: {
      title: "New booking",
      body: "Friday 12 September at 10:00: fade with Travis.",
    },
  },
  {
    id: "cancelled",
    label: "Cancellation",
    detail:
      "A customer cancels online, or someone on the team cancels a trim on your chair.",
    sample: {
      title: "Cancelled",
      body: "Friday 12 September at 10:00: fade with Travis. The slot is free again.",
    },
  },
  {
    id: "moved",
    label: "Trim moved",
    detail:
      "A customer moves a trim online, or the team moves one on your chair.",
    sample: {
      title: "Trim moved",
      body: "Now Saturday 13 September at 11:00: fade with Travis.",
    },
  },
  {
    id: "running_late",
    label: "Customer running late",
    detail: "A customer taps Running late on their booking.",
    sample: {
      title: "Running late",
      body: "Your 10:00 expects to be about 15 minutes late.",
    },
  },
  {
    id: "added_by_team",
    label: "Added to your diary by the team",
    detail: "Someone else on the team books a trim onto your chair.",
    sample: {
      title: "Added to your diary",
      body: "Sean added a trim: Friday 12 September at 10:00, fade.",
    },
  },
  {
    id: "day_ahead",
    label: "Tomorrow, the evening before",
    detail:
      "At six each evening: how many trims tomorrow and when the first is.",
    sample: {
      title: "Tomorrow",
      body: "6 trims on your chair, first at 9:30.",
    },
  },
  {
    id: "overdue",
    label: "Possible no show",
    detail:
      "Ten minutes after a trim was due and nobody has marked it in the chair.",
    sample: {
      title: "Not in the chair yet",
      body: "The 10:00 has not been marked in the chair. Tap to mark them arrived, or a no show.",
    },
  },
];

const trims = (n: number) => `${n} trim${n === 1 ? "" : "s"}`;

/** The evening-before line for one barber's chair. */
export function dayAheadText(count: number, firstMinuteLabel: string | null) {
  if (!count) return "Nothing booked on your chair yet.";
  return `${trims(count)} on your chair, first at ${firstMinuteLabel}.`;
}

/** The evening-before line for the owner: the whole shop, chair by chair. */
export function dayAheadShopText(
  perChair: { name: string; count: number }[],
  firstMinuteLabel: string | null,
) {
  const total = perChair.reduce((n, c) => n + c.count, 0);
  if (!total) return "Nothing booked across the shop yet.";
  return `${trims(total)} across the shop, first at ${firstMinuteLabel}. ${perChair
    .map((c) => `${c.name} ${c.count}`)
    .join(", ")}.`;
}

export function overdueText(timeLabel: string) {
  return `The ${timeLabel} has not been marked in the chair. Tap to mark them arrived, or a no show.`;
}
