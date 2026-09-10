"use client";
import { useState } from "react";
import {
  type Act,
  type Barber,
  type Context,
  type Service,
  canonicalServiceName,
  pounds,
} from "./types";

export function Catalogue({
  ctx,
  act,
  busy,
  reload,
}: {
  ctx: Context;
  act: Act;
  busy: boolean;
  reload: () => Promise<void>;
}) {
  const [edit, setEdit] = useState<{ barber: Barber; service: Service } | null>(
    null,
  );
  const barbers = [...ctx.barbers]
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const services = [...ctx.services].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const priceFor = (barber: Barber, service: Service) =>
    ctx.prices.find(
      (p) => p.barber_id === barber.id && p.service_id === service.id,
    );
  const editing = edit ? priceFor(edit.barber, edit.service) : undefined;
  return (
    <section className="catalogue" aria-label="Catalogue">
      <header className="sec-head">
        <h1>Catalogue</h1>
      </header>
      <p className="staff-muted">
        Every service with its price and timing per chair. Tap a price to change
        it; the website and booking page update straight away. Prices in pounds.
      </p>
      <div className="grid-wrap">
        <table className="grid-table catalogue-table">
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
                  const on =
                    edit?.barber.id === barber.id &&
                    edit?.service.id === service.id;
                  return (
                    <td key={barber.id}>
                      <button
                        type="button"
                        className={on ? "is-editing" : ""}
                        onClick={() => setEdit({ barber, service })}
                      >
                        {price ? (
                          <>
                            <strong>{pounds(price.price_pence)}</strong>
                            <small>{price.duration} min</small>
                          </>
                        ) : (
                          "Set"
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <form
          key={`${edit.barber.id}-${edit.service.id}`}
          className="staff-form inline-editor"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await act("/api/staff/settings", {
              action: "price",
              barber_id: edit.barber.id,
              service_id: edit.service.id,
              price_pence: Math.round(Number(form.get("price")) * 100),
              duration: Number(form.get("duration")),
            });
            setEdit(null);
            await reload();
          }}
        >
          <p className="wide editor-title">
            {canonicalServiceName(edit.service.slug, edit.service.name)} with{" "}
            {edit.barber.name}
          </p>
          <label>
            Price (pounds)
            <input
              name="price"
              type="number"
              step="0.5"
              min="0"
              required
              defaultValue={editing ? editing.price_pence / 100 : ""}
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
              defaultValue={editing?.duration ?? 30}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={busy}>
              Save price
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setEdit(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
