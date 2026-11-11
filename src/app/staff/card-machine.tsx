"use client";
import { useEffect, useRef, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { type Act, pounds } from "./types";
import { toast } from "./toast";

type Reply = {
  status: "waiting" | "paid" | "failed" | "cancelled";
  amount?: number;
  tip?: number;
  barber_gets?: number;
  message?: string;
  practice?: boolean;
};

/**
 * Checkout's card machine: sends the price to the shop's machine, waits for
 * the card, and marks the trim paid when it goes through. In practice mode
 * there's no machine to tap, so it offers a pretend card instead.
 */
export function CardMachine({
  bookingId,
  serviceId,
  pricePence,
  client,
  barber,
  practice,
  act,
  onPaid,
}: {
  bookingId: string;
  serviceId: string;
  pricePence: number | null;
  client: string;
  barber: string;
  practice: boolean;
  act: Act;
  onPaid: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "sending" | "waiting" | "failed">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handle = async (r: Reply) => {
    if (!alive.current) return;
    if (r.status === "paid") {
      if (timer.current) clearTimeout(timer.current);
      const tip = r.tip ?? 0;
      const total = r.amount ?? pricePence ?? 0;
      toast(
        (tip
          ? `Paid £${pounds(total - tip)} plus a £${pounds(tip)} tip on the card machine.`
          : `Paid £${pounds(total)} on the card machine.`) +
          (r.barber_gets
            ? ` £${pounds(r.barber_gets)} goes to ${barber} after the card fee.`
            : ""),
      );
      // One refresh through the diary's own action, then close the sheet.
      await act("/api/staff/terminal", {
        action: "check",
        id: bookingId,
      }).catch(() => undefined);
      onPaid();
      return;
    }
    if (r.status === "failed") {
      setPhase("failed");
      setMessage(r.message || "The card didn’t go through.");
      return;
    }
    if (r.status === "cancelled") {
      setPhase("idle");
      return;
    }
    setPhase("waiting");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void check(), 1500);
  };

  const check = async () => {
    try {
      await handle(
        (await api("/api/staff/terminal", {
          action: "check",
          id: bookingId,
        })) as Reply,
      );
    } catch {
      // A blip on the phone's signal: keep waiting, the machine is still ready.
      if (alive.current) timer.current = setTimeout(() => void check(), 3000);
    }
  };

  const send = async () => {
    if (pricePence === null) return;
    setPhase("sending");
    setMessage("");
    try {
      await handle(
        (await api("/api/staff/terminal", {
          action: "start",
          id: bookingId,
          service: serviceId,
          price_pence: pricePence,
        })) as Reply,
      );
    } catch (e) {
      setPhase("failed");
      setMessage((e as Error).message);
    }
  };

  const run = async (
    action: "simulate" | "cancel",
    card?: "ok" | "declined" | "tip",
  ) => {
    setWorking(true);
    try {
      const r = (await api("/api/staff/terminal", {
        action,
        id: bookingId,
        ...(card ? { card } : {}),
      })) as Reply;
      await handle(r);
    } catch (e) {
      // Cancelling something that never reached the machine just goes back to the start.
      if (action === "cancel") setPhase("idle");
      else {
        setPhase("failed");
        setMessage((e as Error).message);
      }
    } finally {
      setWorking(false);
    }
  };

  if (phase === "idle")
    return (
      <div className="card-machine">
        <button
          type="button"
          className="button-primary"
          disabled={pricePence === null}
          onClick={() => void send()}
        >
          Take £{pricePence === null ? "?" : pounds(pricePence)} on the card
          machine
        </button>
        {practice && (
          <p className="card-machine-note">
            Practice mode. No real money moves.
          </p>
        )}
      </div>
    );

  return (
    <div className="card-machine is-live" role="status" aria-live="polite">
      {phase === "failed" ? (
        <>
          <p className="card-machine-head">Not paid</p>
          <p className="card-machine-text">{message}</p>
          <div className="card-machine-actions">
            <button
              type="button"
              className="button-primary"
              disabled={working}
              onClick={() => void send()}
            >
              Try again
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={working}
              onClick={() => void run("cancel")}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="card-machine-head">
            <span className="card-machine-dot" aria-hidden="true" />
            {phase === "sending"
              ? "Sending to the card machine"
              : "Waiting for the card"}
          </p>
          <p className="card-machine-text">
            {phase === "sending"
              ? "One moment."
              : `£${pounds(pricePence ?? 0)} is on the machine. ${client} can tap their card or phone.`}
          </p>
          {practice && phase === "waiting" && (
            <div className="card-machine-actions">
              <button
                type="button"
                className="button-primary"
                disabled={working}
                onClick={() => void run("simulate", "ok")}
              >
                Tap a test card
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={working}
                onClick={() => void run("simulate", "tip")}
              >
                Test card, £2 tip
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={working}
                onClick={() => void run("simulate", "declined")}
              >
                Try a declined card
              </button>
            </div>
          )}
          {phase === "waiting" && (
            <button
              type="button"
              className="text-button"
              disabled={working}
              onClick={() => void run("cancel")}
            >
              Cancel the payment
            </button>
          )}
        </>
      )}
    </div>
  );
}
