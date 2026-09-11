"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import {
  type Act,
  type Barber,
  type Context,
  type Price,
  type Service,
  pounds,
} from "./types";
import { Loading } from "./spinner";
import { toast } from "./toast";

type Row = Service & { active: boolean };

/**
 * The owner's menu: every service, hidden ones too, with a price and timing
 * per chair. Anything changed here is what the website and the booking page
 * show on their next load.
 */
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
  const [data, setData] = useState<{ services: Row[]; prices: Price[] } | null>(
    null,
  );
  const [edit, setEdit] = useState<{ barber: Barber; service: Row } | null>(
    null,
  );
  const [picked, setPicked] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(
    () =>
      api("/api/staff/settings")
        .then((d) =>
          setData({
            services: (d.services as Row[]) ?? [],
            prices: (d.prices as Price[]) ?? [],
          }),
        )
        .catch((e) => toast((e as Error).message, "error")),
    [],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const refresh = async () => {
    await Promise.all([load(), reload()]);
  };
  const change = async (payload: Record<string, unknown>, done: string) => {
    try {
      await act("/api/staff/settings", payload);
      toast(done);
      await refresh();
      return true;
    } catch {
      return false;
    }
  };

  const barbers = [...ctx.barbers]
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const services = data?.services ?? [];
  const priceFor = (barber: Barber, service: Service) =>
    data?.prices.find(
      (p) => p.barber_id === barber.id && p.service_id === service.id,
    );
  const editing = edit ? priceFor(edit.barber, edit.service) : undefined;
  const current = picked ? services.find((s) => s.id === picked.id) : null;

  return (
    <section className="catalogue" aria-label="Catalogue">
      <header className="sec-head">
        <h1>Catalogue</h1>
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            setAdding(true);
            setPicked(null);
            setEdit(null);
          }}
        >
          Add a service
        </button>
      </header>
      <p className="staff-muted">
        Tap a service name to rename, reorder, hide or delete it. Tap a price to
        change it for that chair. The website and the booking page pick up every
        change straight away. Prices in pounds.
      </p>

      {adding && (
        <form
          className="staff-form inline-editor"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const ok = await change(
              {
                action: "service_add",
                name: String(form.get("name")).trim(),
                price_pence: Math.round(Number(form.get("price")) * 100),
                duration: Number(form.get("duration")),
              },
              `${String(form.get("name")).trim()} added to every chair.`,
            );
            if (ok) setAdding(false);
          }}
        >
          <p className="wide editor-title">New service</p>
          <label className="wide">
            Name
            <input name="name" required minLength={2} maxLength={60} />
          </label>
          <label>
            Price on every chair (pounds)
            <input
              name="price"
              type="number"
              step="0.5"
              min="0"
              required
              defaultValue="20"
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
              defaultValue="30"
            />
          </label>
          <p className="price-hint">
            Every chair offers it at this price to start with. Change any chair
            afterwards by tapping its price.
          </p>
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={busy}>
              Add service
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!data ? (
        <Loading>Loading the catalogue</Loading>
      ) : (
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
                <tr
                  key={service.id}
                  className={service.active ? "" : "is-hidden"}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className={`svc-name ${picked?.id === service.id ? "is-editing" : ""}`}
                      onClick={() => {
                        setPicked(service);
                        setName(service.name);
                        setEdit(null);
                        setAdding(false);
                      }}
                    >
                      {service.name}
                      {!service.active && (
                        <span className="status-chip is-quiet">Hidden</span>
                      )}
                    </button>
                  </th>
                  {barbers.map((barber) => {
                    const price = priceFor(barber, service);
                    const on =
                      edit?.barber.id === barber.id &&
                      edit?.service.id === service.id;
                    const off = price && price.active === false;
                    return (
                      <td key={barber.id}>
                        <button
                          type="button"
                          className={`${on ? "is-editing" : ""} ${off ? "is-off" : ""}`}
                          onClick={() => {
                            setEdit({ barber, service });
                            setPicked(null);
                            setAdding(false);
                          }}
                        >
                          {price ? (
                            off ? (
                              <small>Not offered</small>
                            ) : (
                              <>
                                <strong>{pounds(price.price_pence)}</strong>
                                <small>{price.duration} min</small>
                              </>
                            )
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
      )}

      {current && (
        <form
          key={current.id}
          className="staff-form inline-editor"
          onSubmit={async (event) => {
            event.preventDefault();
            if (name.trim() !== current.name)
              await change(
                { action: "service_rename", id: current.id, name: name.trim() },
                `Renamed to ${name.trim()}.`,
              );
          }}
        >
          <p className="wide editor-title">{current.name}</p>
          <label className="wide">
            Name
            <input
              value={name}
              required
              minLength={2}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="form-actions wide">
            <button
              type="submit"
              className="button-primary"
              disabled={busy || name.trim() === current.name}
            >
              Save name
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy || services[0]?.id === current.id}
              onClick={() =>
                change(
                  { action: "service_move", id: current.id, direction: -1 },
                  `${current.name} moved up.`,
                )
              }
            >
              Move up
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={
                busy || services[services.length - 1]?.id === current.id
              }
              onClick={() =>
                change(
                  { action: "service_move", id: current.id, direction: 1 },
                  `${current.name} moved down.`,
                )
              }
            >
              Move down
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() =>
                change(
                  {
                    action: "service_active",
                    id: current.id,
                    active: !current.active,
                  },
                  current.active
                    ? `${current.name} hidden from the website and the diary.`
                    : `${current.name} is back on the website and in the diary.`,
                )
              }
            >
              {current.active ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    `Delete ${current.name}? Only possible when no booking has ever used it; otherwise hide it.`,
                  )
                )
                  return;
                const ok = await change(
                  { action: "service_delete", id: current.id },
                  `${current.name} deleted.`,
                );
                if (ok) setPicked(null);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setPicked(null)}
            >
              Close
            </button>
          </div>
        </form>
      )}

      {edit && (
        <form
          key={`${edit.barber.id}-${edit.service.id}`}
          className="staff-form inline-editor"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const ok = await change(
              {
                action: "price",
                barber_id: edit.barber.id,
                service_id: edit.service.id,
                price_pence: Math.round(Number(form.get("price")) * 100),
                duration: Number(form.get("duration")),
                active: form.get("offered") === "on",
              },
              `${edit.service.name} with ${edit.barber.name} saved.`,
            );
            if (ok) setEdit(null);
          }}
        >
          <p className="wide editor-title">
            {edit.service.name} with {edit.barber.name}
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
          <label className="check wide">
            <input
              type="checkbox"
              name="offered"
              defaultChecked={editing ? editing.active !== false : true}
            />
            <span>Offered on this chair</span>
          </label>
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={busy}>
              Save
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
