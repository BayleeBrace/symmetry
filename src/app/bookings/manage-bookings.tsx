"use client";

import { useCallback, useEffect, useState } from "react";
import { BARBERS, BusyPeriod, clock, fullDate, makeSlots, money, SERVICES, shopToday, Slot } from "@/lib/booking-data";
import type { ManagedBookingGroup } from "@/lib/manage-bookings";

export function ManageBookings({ token }: { token: string }) {
  const [group, setGroup] = useState<ManagedBookingGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movingId, setMovingId] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/manage?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your trims couldn’t be loaded.");
      setGroup(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your trims couldn’t be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function cancelTrim(bookingId: string) {
    if (!window.confirm("Cancel this trim?")) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bookings/manage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", token, bookingId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That trim couldn’t be cancelled.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That trim couldn’t be cancelled.");
      setLoading(false);
    }
  }

  async function chooseMoveDate(bookingId: string, value: string) {
    setMoveDate(value);
    setSlots([]);
    setError("");
    const appointment = group?.appointments.find((item) => item.id === bookingId);
    if (!appointment || !value) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/availability?date=${value}&barber=${appointment.barber.slug}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Availability couldn’t load.");
      setSlots(makeSlots(value, appointment.barber.slug, appointment.service.slug, result.busy as BusyPeriod[]));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Availability couldn’t load.");
    } finally {
      setLoading(false);
    }
  }

  async function moveTrim(bookingId: string, time: number) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bookings/manage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reschedule", token, bookingId, date: moveDate, time }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That trim couldn’t be moved.");
      setMovingId("");
      setMoveDate("");
      setSlots([]);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That trim couldn’t be moved.");
      setLoading(false);
    }
  }

  if (loading && !group) return <p className="manage-status">loading your trims…</p>;
  if (!group) return <p className="error-message" role="alert">{error || "Your trims couldn’t be loaded."}</p>;

  const activeAppointments = group.appointments.filter((item) => item.status === "booked" || item.status === "arrived");

  return (
    <>
      <div className="manage-intro-row">
        <p>Hi {group.customer.name.split(" ")[0]}. You can move, cancel or add each trim to your calendar here.</p>
        {activeAppointments.length > 1 && <a className="primary-button" href={`/api/calendar?token=${encodeURIComponent(token)}`}>add all to calendar</a>}
      </div>

      <div className="managed-booking-list">
        {group.appointments.map((appointment) => {
          const active = appointment.status === "booked";
          const service = SERVICES.find((item) => item.id === appointment.service.slug);
          return (
            <article className={`managed-booking ${active ? "" : "inactive"}`} key={appointment.id}>
              <div>
                <p className="managed-date">{fullDate(appointment.date)} · {clock(appointment.time)}</p>
                <h2>{appointment.service.name}</h2>
                <p>with {BARBERS[appointment.barber.slug].name} · {appointment.duration} min · £{money(appointment.pricePence / 100)}</p>
                {!active && <span className="booking-status">{appointment.status.replace("_", " ")}</span>}
              </div>

              {active && <div className="manage-links">
                <a href={`/api/calendar?token=${encodeURIComponent(token)}&booking=${appointment.id}`}>add to calendar</a>
                <button onClick={() => { setMovingId(appointment.id); setMoveDate(appointment.date); setSlots([]); }}>move</button>
                <button onClick={() => cancelTrim(appointment.id)}>cancel</button>
              </div>}

              {movingId === appointment.id && service && <div className="move-panel">
                <label>new date<input type="date" min={shopToday()} value={moveDate} onChange={(event) => chooseMoveDate(appointment.id, event.target.value)} /></label>
                {loading && <p>checking the diary…</p>}
                {!loading && moveDate && !slots.length && <p>No available times on this date.</p>}
                {!!slots.length && <div className="move-times">{slots.map((slot) => <button key={slot.time} onClick={() => moveTrim(appointment.id, slot.time)}>{clock(slot.time)}</button>)}</div>}
                <button className="close-move" onClick={() => { setMovingId(""); setSlots([]); }}>keep existing trim</button>
              </div>}
            </article>
          );
        })}
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
    </>
  );
}
