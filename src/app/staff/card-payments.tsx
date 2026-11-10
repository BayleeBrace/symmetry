"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { toast } from "./toast";
import { Loading } from "./spinner";

type Chair = {
  id: string;
  name: string;
  mine: boolean;
  started: boolean;
  ready: boolean;
  needs_details: boolean;
};
type State = {
  mode: "test" | "live" | null;
  owner?: boolean;
  reader?: {
    label: string | null;
    status: string | null;
    simulated: boolean;
  } | null;
  barbers?: Chair[];
};

const go = (url: string) => {
  window.location.href = url;
};

/**
 * More, Card payments. Each barber connects their own Stripe account here so
 * card payments go to their own bank; the owner sees every chair, adds the
 * card machine, and in practice mode adds or removes the test clients.
 */
export function CardPayments({ owner }: { owner: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [code, setCode] = useState("");
  const load = useCallback(
    () =>
      api("/api/staff/card")
        .then((d) => {
          setState(d as State);
          setError("");
        })
        .catch((e) => setError((e as Error).message)),
    [],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const run = async (
    key: string,
    body: unknown,
    then?: (r: unknown) => void,
  ) => {
    setWorking(key);
    try {
      const r = await api("/api/staff/card", body);
      then?.(r);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setWorking("");
    }
  };

  if (error)
    return (
      <section className="staff-panel">
        <p className="staff-error">{error}</p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => void load()}
        >
          Try again
        </button>
      </section>
    );
  if (!state) return <Loading />;
  if (!state.mode)
    return (
      <>
        <section className="staff-panel">
          <h2>Not connected yet.</h2>
          <p>
            Once the shop’s Stripe account is connected, each barber sets up
            here so card payments go straight to their own bank, and checkout
            can send the price to the card machine.
          </p>
        </section>
        {owner && <TestClients mode={null} />}
      </>
    );

  const practice = state.mode === "test";
  const me = state.barbers?.find((b) => b.mine);
  const others = (state.barbers ?? []).filter((b) => !b.mine);
  const status = (b: Chair) =>
    b.ready ? "Ready" : b.started ? "Needs finishing" : "Not set up";

  return (
    <>
      {practice && (
        <section className="staff-panel card-practice">
          <h2>Practice mode.</h2>
          <p>
            Nothing here touches real money. Card payments, payouts and fees all
            work, but with Stripe’s pretend money and a pretend card machine, so
            try anything.
          </p>
          <p className="staff-muted">
            On Stripe’s sign-up pages, use their test details: tap the test
            buttons where they’re offered, phone code 000000, sort code 10-88-00
            and account number 00012345.
          </p>
        </section>
      )}

      {me && (
        <section className="staff-panel">
          <h2>Your card payments.</h2>
          {me.ready ? (
            <p>
              Ready. Card payments on your chair go to your own Stripe account
              and on to your bank, three working days later.
            </p>
          ) : (
            <p>
              {me.started
                ? "Stripe needs a few more details before your card payments can start."
                : "Set up once, about ten minutes: your name, address, photo ID and your own bank details. Stripe asks for them, not the shop."}
            </p>
          )}
          <div className="form-actions">
            {!me.ready && (
              <button
                type="button"
                className="button-primary"
                disabled={working !== ""}
                onClick={() =>
                  void run(
                    "onboard",
                    { action: "onboard", barber: me.id },
                    (r) => go((r as { url: string }).url),
                  )
                }
              >
                {working === "onboard"
                  ? "Opening Stripe…"
                  : me.started
                    ? "Finish setting up"
                    : "Set up card payments"}
              </button>
            )}
            {me.started && (
              <button
                type="button"
                className="button-secondary"
                disabled={working !== ""}
                onClick={() =>
                  void run("dashboard", { action: "dashboard" }, (r) =>
                    go((r as { url: string }).url),
                  )
                }
              >
                See your payouts
              </button>
            )}
          </div>
        </section>
      )}

      <section className="staff-panel">
        <h2>The card machine.</h2>
        {state.reader ? (
          <p>
            {state.reader.label || "Card machine"} ·{" "}
            {state.reader.status === "online" ? "online" : "offline"}
            {state.reader.simulated ? " (pretend, for practice)" : ""}
          </p>
        ) : (
          <p>
            {practice
              ? "No practice card machine yet."
              : "No card machine registered yet."}
            {!owner && " The owner adds it here."}
          </p>
        )}
        {owner && !state.reader && (
          <div className="form-actions">
            {!practice && (
              <label className="card-code">
                Words on the machine’s screen
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="e.g. apple-grape-orange"
                />
              </label>
            )}
            <button
              type="button"
              className="button-primary"
              disabled={working !== "" || (!practice && code.trim().length < 3)}
              onClick={() =>
                void run(
                  "reader",
                  practice
                    ? { action: "add_reader" }
                    : { action: "add_reader", code },
                  () => {
                    toast("Card machine added.");
                    void load();
                  },
                )
              }
            >
              {practice
                ? "Add a practice card machine"
                : "Register the card machine"}
            </button>
          </div>
        )}
      </section>

      {owner && others.length > 0 && (
        <section className="staff-panel">
          <h2>The chairs.</h2>
          <ul className="card-chairs">
            {others.map((b) => (
              <li key={b.id}>
                <span>
                  <strong>{b.name}</strong>
                  <small>{status(b)}</small>
                </span>
                {practice && !b.ready && (
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={working !== ""}
                    onClick={() =>
                      void run(
                        "onboard-" + b.id,
                        { action: "onboard", barber: b.id },
                        (r) => go((r as { url: string }).url),
                      )
                    }
                  >
                    {b.started ? "Finish for them" : "Set up for them"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="staff-muted">
            {practice
              ? "In practice mode you can set up any chair yourself with Stripe’s test details. For real, each barber does their own, signed in as themselves."
              : "Each barber sets up their own, signed in on their phone, in More, Card payments."}
          </p>
        </section>
      )}

      {owner && <TestClients mode={state.mode} />}
    </>
  );
}

/**
 * Owner: pretend clients and trims to try everything on, and one tap to take
 * them out. Adding stops once card payments are live; removing never does, so
 * they can still be cleared after the switch.
 */
function TestClients({ mode }: { mode: "test" | "live" | null }) {
  const [count, setCount] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const load = useCallback(
    () =>
      api("/api/staff/test-data")
        .then((d) => setCount((d as { clients: number }).clients))
        .catch(() => setCount(null)),
    [],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  const run = async (action: "add" | "remove") => {
    if (
      action === "remove" &&
      !confirm(
        "Remove every test client and all their trims? Nothing else is touched.",
      )
    )
      return;
    setWorking(true);
    try {
      const r = (await api("/api/staff/test-data", { action })) as {
        clients: number;
        trims: number;
        cards?: number;
      };
      toast(
        action === "add"
          ? `Added ${r.clients} test clients and ${r.trims} trims${r.cards ? ", each with a test card saved" : ""}. They’re in the diary now.`
          : `Removed ${r.clients} test clients and ${r.trims} trims.`,
      );
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setWorking(false);
    }
  };
  if (mode === "live" && !count) return null;
  return (
    <section className="staff-panel">
      <h2>Test clients.</h2>
      <p>
        Ten pretend clients with a few past visits each, and four trims a day on
        every chair for the next ten days.
        {mode === "test"
          ? " Each has a test card saved for trying no-show fees."
          : ""}{" "}
        They have no email or mobile, so nothing is ever sent to them.
      </p>
      <p className="staff-muted">
        {count === null
          ? "Checking…"
          : count > 0
            ? `${count} test clients in the app now.`
            : "None in the app now."}
      </p>
      <div className="form-actions">
        <button
          type="button"
          className="button-primary"
          disabled={working || count === null || count > 0 || mode === "live"}
          onClick={() => void run("add")}
        >
          Add test clients
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={working || !count}
          onClick={() => void run("remove")}
        >
          Remove all test clients
        </button>
      </div>
    </section>
  );
}
