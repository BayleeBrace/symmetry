"use client";
import { useCallback, useEffect, useState } from "react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";
import { staffApi as api } from "@/lib/staff-client";
import { toast } from "./toast";

export function Account({ owner, name }: { owner: boolean; name: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="staff-panel">
      <h2>Your account.</h2>
      <p>
        Signed in as {name}
        {owner ? ", owner" : ""}. Change your password here; it takes effect the
        next time you sign in.
      </p>
      <form
        className="staff-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          if (data.get("password") !== data.get("confirm")) {
            toast("The two passwords do not match.", "error");
            return;
          }
          setBusy(true);
          try {
            await api("/api/staff/password", {
              password: data.get("password"),
            });
            form.reset();
            toast("Password changed.");
          } catch (e) {
            toast((e as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          New password (at least 8 characters)
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label>
          Type it again
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={busy}>
            Change password
          </button>
        </div>
      </form>
      <FaceId />
    </section>
  );
}

type Passkey = {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
};

/** Which phone this is, for the list. Best guess from the browser. */
function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
}

function friendly(e: unknown) {
  const err = e as Error & { name?: string };
  if (err.name === "NotAllowedError")
    return "Face ID was cancelled or timed out. Try again.";
  if (err.name === "InvalidStateError")
    return "This phone is already set up for Face ID.";
  return err.message || "Face ID could not be set up.";
}

function FaceId() {
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(() => {
    api("/api/staff/passkey")
      .then((d) => setKeys(d.passkeys))
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    (browserSupportsWebAuthn()
      ? platformAuthenticatorIsAvailable()
      : Promise.resolve(false)
    )
      .then(setSupported)
      .catch(() => setSupported(false));
    return () => clearTimeout(t);
  }, [load]);

  async function setUp() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const optionsJSON = await api("/api/staff/passkey", {
        action: "register-options",
      });
      const response = await startRegistration({ optionsJSON });
      await api("/api/staff/passkey", {
        action: "register-verify",
        response,
        label: deviceLabel(),
      });
      setNotice(
        "Done. Next time, tap “Sign in with Face ID” on the sign-in screen.",
      );
      load();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="passkeys">
      <h3>Face ID on this phone.</h3>
      <p className="staff-muted">
        Set it up once on each phone you use. After that you sign in with Face
        ID or fingerprint instead of typing your password. Works in the
        home-screen app and in Safari, on iOS 17 or later.
      </p>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-note" role="status">
          {notice}
        </p>
      )}
      {keys && keys.length > 0 && (
        <div className="passkey-list">
          {keys.map((k) => (
            <div className="passkey" key={k.id}>
              <span>
                {k.label}
                <small>
                  Set up{" "}
                  {new Date(k.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                  {k.last_used_at
                    ? ` · last used ${new Date(k.last_used_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : " · not used yet"}
                </small>
              </span>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Remove Face ID from ${k.label}?`)) return;
                  setBusy(true);
                  try {
                    await api("/api/staff/passkey", {
                      action: "remove",
                      id: k.id,
                    });
                    load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button-primary"
          disabled={busy || supported === false}
          onClick={() => void setUp()}
        >
          Set up Face ID on this phone
        </button>
        {supported === false && (
          <span className="form-note">
            This browser cannot use Face ID or fingerprint sign-in.
          </span>
        )}
      </div>
    </div>
  );
}
