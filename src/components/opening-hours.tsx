import { hourWord, inputTime, OPENING_HOURS } from "@/lib/booking-data";
export function OpeningHours({ hours }: { hours: typeof OPENING_HOURS }) {
  return (
    <dl className="opening-hours">
      {[
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ].map((day, i) => {
        const h = hours[(i + 1) % 7];
        return (
          <div key={day} className={h ? "" : "closed"}>
            <dt>{day}</dt>
            <dd>
              {h ? (
                <>
                  <time dateTime={inputTime(h[0])}>{hourWord(h[0])}</time>
                  <span> to </span>
                  <time dateTime={inputTime(h[1])}>{hourWord(h[1])}</time>
                </>
              ) : (
                "closed"
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
