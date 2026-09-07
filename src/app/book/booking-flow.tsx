"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays, BARBERS, BarberChoice, BarberId, BusyPeriod, clock, dateKey, fullDate,
  isOpen, makeSlots, money, parseDate, SERVICES, Slot,
} from "@/lib/booking-data";

type Draft = Slot & { date: string; service: string; alternatives?: Slot[] };
type Details = { name: string; email: string; country: string; phone: string; marketing: boolean };

const countries = [
  ["GB", "UK", "+44"], ["IE", "Ireland", "+353"], ["FR", "France", "+33"],
  ["ES", "Spain", "+34"], ["PT", "Portugal", "+351"], ["US", "USA", "+1"],
];

const monthTitle = (value: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(parseDate(`${value}-01`));

function shiftMonth(value: string, amount: number) {
  const date = parseDate(`${value}-01`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return dateKey(date).slice(0, 7);
}

async function fetchBusy(date: string, barber: BarberChoice): Promise<{ busy: BusyPeriod[]; mode: "preview" | "live" }> {
  const response = await fetch(`/api/availability?date=${date}&barber=${barber}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Availability couldn’t load. Try again.");
  return response.json();
}

export function BookingFlow({ initialDate, initialBarber = "sean" }: { initialDate: string; initialBarber?: BarberChoice }) {
  const [step, setStep] = useState(0);
  const [barber, setBarber] = useState<BarberChoice>(initialBarber);
  const [service, setService] = useState("");
  const [date, setDate] = useState(initialDate);
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [busy, setBusy] = useState<BusyPeriod[]>([]);
  const [mode, setMode] = useState<"preview" | "live">("preview");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [period, setPeriod] = useState<"morning" | "afternoon" | "evening">("morning");
  const [repeat, setRepeat] = useState(0);
  const [count, setCount] = useState(4);
  const [basket, setBasket] = useState<Draft[]>([]);
  const [pending, setPending] = useState<Draft[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ reference: string; manageToken?: string } | null>(null);
  const [details, setDetails] = useState<Details>({ name: "", email: "", country: "GB", phone: "", marketing: false });
  const timesRef = useRef<HTMLHeadingElement>(null);
  const repeatRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const serviceInfo = SERVICES.find((item) => item.id === service);
  const slots = useMemo(() => service ? makeSlots(date, barber, service, busy) : [], [date, barber, service, busy]);
  const grouped = {
    morning: slots.filter((item) => item.time < 720),
    afternoon: slots.filter((item) => item.time >= 720 && item.time < 1020),
    evening: slots.filter((item) => item.time >= 1020),
  };
  const activePeriod = grouped[period].length ? period : grouped.morning.length ? "morning" : grouped.afternoon.length ? "afternoon" : "evening";

  useEffect(() => {
    if (step !== 2 || !service) return;
    let current = true;
    fetchBusy(date, barber).then((result) => {
      if (!current) return;
      setBusy(result.busy);
      setMode(result.mode);
    }).catch((reason: Error) => current && setError(reason.message)).finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [date, barber, service, step]);

  const guide = (ref: React.RefObject<HTMLElement | null>) => {
    if (window.matchMedia("(max-width: 760px)").matches) requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  };

  const chooseDate = (value: string) => {
    setLoading(true); setDate(value); setSlot(null); setError(""); setPending(null);
    guide(timesRef);
  };

  async function addDates() {
    if (!slot || !service) return;
    const drafts: Draft[] = Array.from({ length: repeat ? count : 1 }, (_, index) => ({ ...slot, service, date: addDays(date, repeat * index) }));
    if (basket.length + drafts.length > 12) return setError("You can book up to 12 trims together.");
    setLoading(true); setError("");
    try {
      const checked = await Promise.all(drafts.map(async (item) => {
        const result = await fetchBusy(item.date, item.barber);
        const alternatives = makeSlots(item.date, item.barber, item.service, result.busy);
        return alternatives.some((choice) => choice.time === item.time) ? item : { ...item, alternatives: alternatives.slice(0, 6) };
      }));
      if (checked.some((item) => item.alternatives)) {
        setPending(checked);
        setError("One or more weeks need another time.");
      } else {
        setBasket((items) => [...items, ...checked]);
        setStep(3); setSlot(null); setPending(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Those dates couldn’t be checked.");
    } finally { setLoading(false); }
  }

  async function findNextDay(index: number) {
    if (!pending) return;
    setLoading(true); setError("");
    try {
      for (let offset = 1; offset <= 7; offset++) {
        const nextDate = addDays(pending[index].date, offset);
        if (!isOpen(nextDate)) continue;
        const result = await fetchBusy(nextDate, pending[index].barber);
        const choice = makeSlots(nextDate, pending[index].barber, pending[index].service, result.busy)[0];
        if (choice) {
          setPending((items) => items?.map((item, itemIndex) => itemIndex === index ? { ...item, ...choice, date: nextDate, alternatives: undefined } : item) ?? null);
          return;
        }
      }
      setError("There isn’t another gap in the following week.");
    } finally { setLoading(false); }
  }

  function keepResolved() {
    if (!pending || pending.some((item) => item.alternatives)) return;
    setBasket((items) => [...items, ...pending]);
    setPending(null); setStep(3); setSlot(null); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finishBooking() {
    if (!formRef.current?.reportValidity() || !basket.length) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer: details, appointments: basket }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your booking couldn’t be completed.");
      setDone({ reference: result.reference, manageToken: result.manageToken });
      setMode(result.mode);
      setDetails({ name: "", email: "", country: "GB", phone: "", marketing: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your booking couldn’t be completed."); }
    finally { setLoading(false); }
  }

  const days = useMemo(() => {
    const first = parseDate(`${month}-01`), last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
    const offset = (first.getUTCDay() + 6) % 7;
    return { offset, dates: Array.from({ length: last.getUTCDate() }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`) };
  }, [month]);

  const summary = step === 0 ? `with ${barber === "any" ? "any barber" : BARBERS[barber].name}` : step === 1 && serviceInfo ? serviceInfo.name : step === 2 && slot ? `${fullDate(date)} · ${clock(slot.time)} with ${BARBERS[slot.barber].name}` : `${basket.length} booking${basket.length === 1 ? "" : "s"} · £${money(basket.reduce((sum, item) => sum + item.price, 0))}`;
  const nextDisabled = loading || (step === 1 && !service) || (step === 2 && (!slot || Boolean(pending?.some((item) => item.alternatives)))) || (step === 3 && !basket.length);

  return (
    <>
      <div className="booking-frame">
        <p className="app-note">{mode === "live" ? "live availability" : "development preview · no trims are reserved yet"}</p>
        <div className="progress" aria-label="Booking progress">
          {["barber", "service", "dates", "booking"].map((label, index) => <span key={label} className={step === index ? "active" : ""}>{index + 1} · {label}</span>)}
        </div>
        <section className="booking-view" key={`${step}-${pending ? "pending" : "normal"}`}>
          {step === 0 && <>
            <h1>your barber.</h1><p className="intro">Choose your usual chair, or take the first available.</p>
            <div className="choice-grid">
              {(Object.entries(BARBERS) as [BarberId, typeof BARBERS[BarberId]][]).map(([id, item]) => <button key={id} className={`choice ${barber === id ? "selected" : ""}`} onClick={() => setBarber(id)}><strong>{item.name}</strong><small>{item.role}</small></button>)}
              <button className={`choice any ${barber === "any" ? "selected" : ""}`} onClick={() => setBarber("any")}><strong>any barber</strong><small>show me the first available trim</small></button>
            </div>
          </>}
          {step === 1 && <>
            <h1>your trim.</h1><p className="intro">{barber === "any" ? "You’ll see the exact barber, time and price before adding." : `with ${BARBERS[barber].name}`}</p>
            <div className="service-list">{SERVICES.map((item) => {
              const detail = barber === "any" ? Object.values(item.barbers) : [item.barbers[barber]];
              const min = Math.min(...detail.map((value) => value.price)), max = Math.max(...detail.map((value) => value.price));
              return <button className={`service-row ${service === item.id ? "selected" : ""}`} key={item.id} onClick={() => setService(item.id)}><span>{item.name}<small>{Math.min(...detail.map((value) => value.duration))}{detail.some((value) => value.duration !== detail[0].duration) ? `–${Math.max(...detail.map((value) => value.duration))}` : ""} min</small></span><b>£{min === max ? money(min) : `${money(min)}–${money(max)}`}</b></button>;
            })}</div>
          </>}
          {step === 2 && serviceInfo && <>
            <h1>{pending ? "your next few." : "your dates."}</h1>
            <p className="intro">{pending ? "Keep the weeks that work. Change only the ones that don’t." : `${serviceInfo.name} · ${barber === "any" ? "your barber is shown with each time" : BARBERS[barber].name}`}</p>
            {pending ? pending.map((item, index) => <article className="resolution" key={`${item.date}-${index}`}>
              <h3>{fullDate(item.date)} · {item.alternatives ? "choose another time" : `${clock(item.time)} with ${BARBERS[item.barber].name}`}</h3>
              {item.alternatives && <><div className="alternate-grid">{item.alternatives.map((choice) => <button key={`${choice.barber}-${choice.time}`} onClick={() => setPending((items) => items?.map((draft, itemIndex) => itemIndex === index ? { ...draft, ...choice, alternatives: undefined } : draft) ?? null)}>{clock(choice.time)} · {BARBERS[choice.barber].name}</button>)}</div><button className="quiet-button" onClick={() => findNextDay(index)}>try the next open day</button></>}
            </article>) : <>
              <div className="month-nav"><button onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= initialDate.slice(0, 7)} aria-label="Previous month">‹</button><strong>{monthTitle(month)}</strong><button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= addDays(initialDate, 120).slice(0, 7)} aria-label="Next month">›</button></div>
              <div className="calendar">{["M","T","W","T","F","S","S"].map((day, index) => <span className="weekday" key={`${day}-${index}`}>{day}</span>)}{Array.from({ length: days.offset }).map((_, index) => <span key={`blank-${index}`} />)}{days.dates.map((value) => { const enabled = value >= initialDate && value <= addDays(initialDate, 120) && isOpen(value); return <button className={`date-cell ${date === value ? "selected" : ""}`} disabled={!enabled} onClick={() => chooseDate(value)} key={value}>{Number(value.slice(-2))}</button>; })}</div>
              <h2 ref={timesRef} className="times-heading">{fullDate(date)}</h2>
              <div className="periods">{(["morning","afternoon","evening"] as const).map((name) => <button className={`period ${activePeriod === name ? "selected" : ""}`} disabled={!grouped[name].length} onClick={() => setPeriod(name)} key={name}>{name}</button>)}</div>
              <div className="time-grid">{loading ? <p>Checking the diary…</p> : grouped[activePeriod].map((choice) => <button className={`time-cell ${slot?.time === choice.time && slot.barber === choice.barber ? "selected" : ""}`} key={`${choice.barber}-${choice.time}`} onClick={() => { setSlot(choice); guide(repeatRef); }}>{clock(choice.time)}{barber === "any" && <small>{BARBERS[choice.barber].name} · £{money(choice.price)}</small>}</button>)}</div>
              {!loading && !slots.length && <p className="error-message">No space on this day. Try another date.</p>}
              <div ref={repeatRef} className="repeat-box"><label>repeat this trim<select value={repeat} onChange={(event) => setRepeat(Number(event.target.value))}><option value="0">just once</option><option value="7">every week</option><option value="14">every 2 weeks</option><option value="28">every 4 weeks</option></select></label>{repeat > 0 && <label>trims in total<select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[2,3,4,5,6,8].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>}</div>
            </>}
          </>}
          {step === 3 && !done && <>
            <h1>your booking.</h1><p className="intro">Check every trim, then enter your details once.</p>
            {basket.map((item, index) => <article className="basket-item" key={`${item.date}-${item.time}-${index}`}><h3>{fullDate(item.date)} · {clock(item.time)}</h3><p>{SERVICES.find((serviceItem) => serviceItem.id === item.service)?.name} with {BARBERS[item.barber].name} · £{money(item.price)}</p><button onClick={() => setBasket((items) => items.filter((_, itemIndex) => itemIndex !== index))}>remove</button></article>)}
            <button className="quiet-button" onClick={() => { setStep(0); setSlot(null); }}>add another trim</button>
            <form ref={formRef} className="details-form" onSubmit={(event: FormEvent) => { event.preventDefault(); finishBooking(); }}>
              <div className="field"><label>your name<input required minLength={2} autoComplete={mode === "live" ? "name" : "off"} value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} /></label></div>
              <div className="field"><label>email<input required type="email" autoComplete={mode === "live" ? "email" : "off"} value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} /></label></div>
              <div className="field"><label>mobile number<span className="phone-row"><select aria-label="Country code" value={details.country} onChange={(event) => setDetails({ ...details, country: event.target.value })}>{countries.map(([code, name, dial]) => <option value={code} key={code}>{name} {dial}</option>)}</select><input required type="tel" inputMode="tel" autoComplete={mode === "live" ? "tel-national" : "off"} placeholder="07700 900123" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} /></span></label></div>
              <label className="marketing"><input type="checkbox" checked={details.marketing} onChange={(event) => setDetails({ ...details, marketing: event.target.checked })} /><span>Email me occasional news, offers and product launches from Symmetry. Optional—you can unsubscribe any time.</span></label>
              <button type="submit" hidden>finish</button>
            </form>
          </>}
          {step === 3 && done && <><h1>{mode === "live" ? "you’re booked." : "preview complete."}</h1><div className="success-card"><p>{mode === "live" ? "Your trims are reserved. We’ll send your confirmation and secure management link shortly." : "The complete journey works. No real trims were reserved and your details were not saved."}</p><p>reference · <strong>{done.reference}</strong></p>{mode === "live" && done.manageToken && <div className="success-actions"><a className="primary-button" href={`/api/calendar?token=${encodeURIComponent(done.manageToken)}`}>add to calendar</a><a className="text-link" href={`/bookings?token=${encodeURIComponent(done.manageToken)}`}>manage your trims</a></div>}</div></>}
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>
      </div>
      <div className="booking-bar"><p>{summary}</p><div className={`booking-actions ${step === 0 || done ? "single" : ""}`}>{step > 0 && !done && <button className="back" onClick={() => { setError(""); if (pending) setPending(null); else setStep(step - 1); }}>back</button>}<button disabled={nextDisabled} onClick={() => { setError(""); if (done) { setDone(null); setBasket([]); setStep(0); } else if (step < 2) { if (step === 1) setLoading(true); setStep(step + 1); } else if (step === 2) { if (pending) keepResolved(); else addDates(); } else finishBooking(); }}>{loading ? "checking…" : done ? "start again" : step === 0 ? "choose a trim" : step === 1 ? "choose dates" : step === 2 ? pending ? "keep these dates" : repeat ? "add these trims" : "add this trim" : mode === "live" ? "confirm booking" : "finish preview"}</button></div></div>
    </>
  );
}
