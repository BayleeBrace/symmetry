/**
 * Cancelled trims leave the diary, the way Fresha hides them, so the day shows
 * only what is still happening. One stays while a late-cancellation fee waits
 * for the owner to charge or waive, because the booking is where that is done.
 * Cancelled trims still count in the client's history, sales and reports.
 */
export function showsInDiary(booking: {
  status: string;
  fee_status?: string | null;
}) {
  return (
    booking.status !== "cancelled" ||
    booking.fee_status === "review" ||
    booking.fee_status === "charging"
  );
}
