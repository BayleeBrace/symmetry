"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { PUSH_KINDS, type PushKind } from "@/lib/push-kinds";

type Info = {
  configured: boolean;
  notify: Record<string, boolean>;
  devices: number;
};

/** Push notifications for this staff member: this phone, what to get, and a test button. */
export function NotificationSettings() {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [testKind, setTestKind] = useState<PushKind>("new_booking");

  const load = useCallback(
    () =>
      api("/api/staff/notify")
        .then((d) => {
          setInfo(d as Info);
          setError("");
        })
        .catch((e) => setError((e as Error).message)),
    [],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      const ok = "serviceWorker" in navigator && "PushManager" in window;
      setSupported(ok);
      if (ok)
        navigator.serviceWorker
          .getRegistration()
          .then((r) => r?.pushManager.getSubscription())
          .then((s) => setEnabled(Boolean(s)))
          .catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const say = (text: string, bad = false) => {
    setMessage(text);
    setFailed(bad);
  };

  const enable = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (!supported)
        throw new Error(
          "This browser cannot show notifications. On iPhone, add the staff app to your Home Screen and open it from there.",
        );
      const { key } = (await api("/api/push")) as { key: string | null };
      if (!key)
        throw new Error(
          "Push is not set up on the server yet: the VAPID keys are missing in Vercel.",
        );
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "Notifications were not allowed. You can turn them on in the phone's settings for this app.",
        );
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      await api("/api/push", { subscription: sub });
      setEnabled(true);
      say("Notifications are on for this phone.");
      await load();
    } catch (e) {
      say((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await api("/api/staff/notify", {
          action: "forget",
          endpoint: sub.endpoint,
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      say("Notifications are off for this phone.");
      await load();
    } catch (e) {
      say((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (kind: PushKind, on: boolean) => {
    if (!info) return;
    const notify = { ...info.notify, [kind]: on };
    setInfo({ ...info, notify });
    try {
      await api("/api/staff/notify", { action: "prefs", notify });
    } catch (e) {
      say((e as Error).message, true);
      await load();
    }
  };

  const test = async () => {
    setBusy(true);
    setMessage("");
    try {
      const r = (await api("/api/staff/notify", {
        action: "test",
        kind: testKind,
      })) as { sent: number; devices: number };
      say(
        r.sent
          ? `Sent to ${r.sent} phone${r.sent === 1 ? "" : "s"}. It should appear in a moment.`
          : `Your ${r.devices} phone${r.devices === 1 ? "" : "s"} did not accept it. Turn notifications off and on again on the phone.`,
        !r.sent,
      );
    } catch (e) {
      say((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  if (!info)
    return (
      <p role="status" className="staff-muted">
        {error || "Checking…"}
      </p>
    );

  return (
    <div className="notify">
      {!info.configured && (
        <p className="staff-error" role="alert">
          Push is not set up on the server yet. Add VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY and VAPID_CONTACT in Vercel and redeploy. Until then
          nothing can be sent.
        </p>
      )}
      <section className="staff-panel">
        <h2>This phone.</h2>
        <p>
          {enabled
            ? "Notifications are on for this phone."
            : supported === false
              ? "This browser cannot show notifications. On iPhone, add the staff app to your Home Screen (Share, then Add to Home Screen), open it from there, and come back here."
              : "Turn notifications on for this phone. Do it on each phone you use."}
          {info.devices > 0 &&
            ` ${info.devices} phone${info.devices === 1 ? " is" : "s are"} enabled for your account.`}
        </p>
        <div className="form-actions">
          {enabled ? (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => void disable()}
            >
              Turn off on this phone
            </button>
          ) : (
            <button
              type="button"
              className="button-primary"
              disabled={busy || !info.configured}
              onClick={() => void enable()}
            >
              Enable on this phone
            </button>
          )}
        </div>
      </section>

      <section className="staff-panel">
        <h2>Send a test.</h2>
        <p>
          See what each one looks like on the lock screen. Goes to every phone
          enabled for your account, whatever the choices below say.
        </p>
        <div className="notify-test">
          <label>
            <span className="sr-only">Which notification</span>
            <select
              value={testKind}
              onChange={(e) => setTestKind(e.target.value as PushKind)}
            >
              {PUSH_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button-primary"
            disabled={busy || !info.configured}
            onClick={() => void test()}
          >
            Send a test to my phone
          </button>
        </div>
      </section>

      <section className="staff-panel">
        <h2>What you get.</h2>
        <p>Everything is on to start with. Switch off what you do not want.</p>
        <ul className="notify-kinds">
          {PUSH_KINDS.map((k) => {
            const on = info.notify[k.id] !== false;
            return (
              <li key={k.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => void toggle(k.id, e.target.checked)}
                  />
                  <span>
                    <strong>{k.label}</strong>
                    <small>{k.detail}</small>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "staff-error" : "queue-result"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
