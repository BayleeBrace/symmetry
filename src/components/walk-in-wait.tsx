import { hourWord } from "@/lib/booking-data";
import { currentWalkInWait } from "@/lib/walk-in-wait";

/** "Walk-ins: about 20 minutes' wait right now." Hidden while the shop is closed. */
export async function WalkInWait({ className = "" }: { className?: string }) {
  const wait = await currentWalkInWait();
  if (!wait || wait.state === "closed") return null;
  const text =
    wait.state === "free"
      ? "a chair is free now."
      : wait.state === "wait"
        ? `about ${wait.minutes} minutes’ wait right now.`
        : wait.state === "later"
          ? `next free chair about ${hourWord(wait.at)}. Book a trim to skip the wait.`
          : "no space left today. Book a trim for another day.";
  return (
    <p className={`walk-in-wait ${className}`.trim()}>
      <span className="walk-in-label">Walk-ins:</span> {text}
    </p>
  );
}
