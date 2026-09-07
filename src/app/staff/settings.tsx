"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { hourWord, inputTime } from "@/lib/booking-data";
import {
  type Act,
  type Barber,
  type Diary,
  type Service,
  WEEKDAYS,
  canonicalServiceName,
  pounds,
} from "./types";

type Policy = {
  cancellation_hours: number;
  late_percent: number;
  no_show_percent: number;
  policy_confirmed: boolean;
};
type Schedule = {
  barber_id: string;
  iso_weekday: number;
  open_minute: number | null;
  close_minute: number | null;
};

const minuteOf = (value: FormDataEntryValue | null) => {
  if (!value) return null;
  const [h, m] = String(value).split(":").map(Number);
  return h * 60 + m;
};

export function Settings({
  diary,
  act,
  busy,
}: {
  diary: Diary;
  act: Act;
  busy: boolean;
}) {
  const [data, setData] = useState<{
    policy: Policy;
    schedules: Schedule[];
  } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editPrice, setEditPrice] = useState<{
    barber: Barber;
    service: Service;
  } | null>(null);
  const [editHours, setEditHours] = useState<{
    barber: Barber;
    day: number;
  } | null>(null);
  const reload = useCallback(() => {
    api("/api/staff/settings")
      .then((d) => {
        setData(d);
        setLoadError("");
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);
  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);
  if (!data)
    return (
      <p role="status" className="staff-muted">
        {loadError || "Loading settings…"}
      </p>
    );
  const barbers = diary.barbers.filter((b) => b.active !== false);
  const services = [...diary.services].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const priceFor = (barber: Barber, service: Service) =>
    diary.prices.find(
      (p) => p.barber_id === barber.id && p.service_id === service.id,
    );
  const scheduleFor = (barber: Barber, day: number) =>
    data.schedules.find(
      (s) => s.barber_id === barber.id && s.iso_weekday === day,
    );
  const editingPrice = editPrice
    ? priceFor(editPrice.barber, editPrice.service)
    : undefined;
  const editingSchedule = editHours
    ? scheduleFor(editHours.barber, editHours.day)
    : undefined;

  return (
    <div className="settings">
      <section className="settings-block">
        <h2>Cancellation policy.</h2>
        <p className="staff-muted">
          Changes apply to new bookings. Existing bookings keep the policy
          accepted at checkout.
        </p>
        <form
          className="staff-form policy-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await act("/api/staff/settings", {
              action: "policy",
              cancellation_hours: Number(form.get("hours")),
              late_percent: Number(form.get("late")),
              no_show_percent: Number(form.get("noShow")),
              policy_confirmed: form.get("confirmed") === "on",
            });
            reload();
          }}
        >
          <label>
            Free cancellation notice (hours)
            <input
              name="hours"
              type="number"
              min="0"
              max="168"
              defaultValue={data.policy.cancellation_hours}
            />
          </label>
          <label>
            Late cancellation (%)
            <input
              name="late"
              type="number"
              min="0"
              max="100"
              defaultValue={data.policy.late_percent}
            />
          </label>
          <label>
            No-show (%)
            <input
              name="noShow"
              type="number"
              min="0"
              max="100"
              defaultValue={data.policy.no_show_percent}
            />
          </label>
          <label className="check wide">
            <input
              type="checkbox"
              name="confirmed"
              defaultChecked={data.policy.policy_confirmed}
            />
            <span>I confirm this is the shop’s policy</span>
          </label>
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={busy}>
              Save policy
            </button>
          </div>
        </form>
      </section>

      <section className="settings-block">
        <h2>Prices and timings.</h2>
        <p className="staff-muted">
          Prices in pounds. Tap a price to change it. The website and booking
          page update straight away.
        </p>
        <div className="grid-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                {barbers.map((b) => (
                  <th scope="col" key={b.id}>
                    {b.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id}>
                  <th scope="row">
                    {canonicalServiceName(service.slug, service.name)}
                  </th>
                  {barbers.map((barber) => {
                    const price = priceFor(barber, service);
                    const editing =
                      editPrice?.barber.id === barber.id &&
                      editPrice?.service.id === service.id;
                    return (
                      <td key={barber.id}>
                        <button
                          type="button"
                          className={editing ? "is-editing" : ""}
                          onClick={() => setEditPrice({ barber, service })}
                        >
                          {price
                            ? `${pounds(price.price_pence)} · ${price.duration} min`
                            : "Set"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editPrice && (
          <form
            key={`${editPrice.barber.id}-${editPrice.service.id}`}
            className="staff-form inline-editor"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              await act("/api/staff/settings", {
                action: "price",
                barber_id: editPrice.barber.id,
                service_id: editPrice.service.id,
                price_pence: Math.round(Number(form.get("price")) * 100),
                duration: Number(form.get("duration")),
              });
              setEditPrice(null);
            }}
          >
            <p className="wide editor-title">
              {canonicalServiceName(
                editPrice.service.slug,
                editPrice.service.name,
              )}{" "}
              with {editPrice.barber.name}
            </p>
            <label>
              Price (pounds)
              <input
                name="price"
                type="number"
                step="0.5"
                min="0"
                required
                defaultValue={
                  editingPrice ? editingPrice.price_pence / 100 : ""
                }
              />
            </label>
            <label>
              Duration (minutes)
              <input
                name="duration"
                type="number"
                step="5"
                min="5"
                max="480"
                required
                defaultValue={editingPrice?.duration ?? 30}
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="button-primary" disabled={busy}>
                Save price
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setEditPrice(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="settings-block">
        <h2>Weekly hours.</h2>
        <p className="staff-muted">
          Each barber’s usual week. A chair without its own hours follows the
          shop hours. Use the breaks tab for holidays and one-off changes;
          weekly hours cannot change while future bookings exist for that chair.
        </p>
        <div className="grid-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">Chair</th>
                {WEEKDAYS.map((day) => (
                  <th scope="col" key={day}>
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {barbers.map((barber) => (
                <tr key={barber.id}>
                  <th scope="row">{barber.name}</th>
                  {WEEKDAYS.map((day, index) => {
                    const schedule = scheduleFor(barber, index + 1);
                    const editing =
                      editHours?.barber.id === barber.id &&
                      editHours?.day === index + 1;
                    return (
                      <td key={day}>
                        <button
                          type="button"
                          className={editing ? "is-editing" : ""}
                          onClick={() =>
                            setEditHours({ barber, day: index + 1 })
                          }
                        >
                          {!schedule
                            ? "Shop hours"
                            : schedule.open_minute === null ||
                                schedule.close_minute === null
                              ? "Off"
                              : `${hourWord(schedule.open_minute)} to ${hourWord(schedule.close_minute)}`}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editHours && (
          <form
            key={`${editHours.barber.id}-${editHours.day}`}
            className="staff-form inline-editor"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const off = form.get("off") === "on";
              await act("/api/staff/settings", {
                action: "schedule",
                barber_id: editHours.barber.id,
                iso_weekday: editHours.day,
                open_minute: off ? null : minuteOf(form.get("open")),
                close_minute: off ? null : minuteOf(form.get("close")),
              });
              setEditHours(null);
              reload();
            }}
          >
            <p className="wide editor-title">
              {editHours.barber.name} on {WEEKDAYS[editHours.day - 1]}s
            </p>
            <label>
              Start
              <input
                name="open"
                type="time"
                step="900"
                defaultValue={
                  editingSchedule?.open_minute != null
                    ? inputTime(editingSchedule.open_minute)
                    : "09:00"
                }
              />
            </label>
            <label>
              Finish
              <input
                name="close"
                type="time"
                step="900"
                defaultValue={
                  editingSchedule?.close_minute != null
                    ? inputTime(editingSchedule.close_minute)
                    : "18:00"
                }
              />
            </label>
            <label className="check wide">
              <input
                type="checkbox"
                name="off"
                defaultChecked={
                  Boolean(editingSchedule) &&
                  editingSchedule?.open_minute === null
                }
              />
              <span>Day off</span>
            </label>
            <div className="form-actions">
              <button type="submit" className="button-primary" disabled={busy}>
                Save hours
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setEditHours(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
