"use client";
import { useState } from "react";
import { staffApi as api } from "@/lib/staff-client";

export function Account({ owner, name }: { owner: boolean; name: string }) {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
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
            setFailed(true);
            setMessage("The two passwords do not match.");
            return;
          }
          setBusy(true);
          setMessage("");
          try {
            await api("/api/staff/password", {
              password: data.get("password"),
            });
            form.reset();
            setFailed(false);
            setMessage("Password changed.");
          } catch (e) {
            setFailed(true);
            setMessage((e as Error).message);
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
          {message && (
            <span
              role={failed ? "alert" : "status"}
              className={failed ? "form-error" : "form-note"}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
