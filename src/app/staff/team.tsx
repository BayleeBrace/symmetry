"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";

type Row = {
  barber: {
    id: string;
    name: string;
    slug: string;
    role_label: string;
    active: boolean;
  };
  account: {
    user_id: string;
    role: "owner" | "barber";
    active: boolean;
    email: string;
    last_sign_in: string | null;
  } | null;
};

export function Team() {
  const [team, setTeam] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const load = useCallback(() => {
    api("/api/staff/team")
      .then((d) => {
        setTeam(d.team);
        setError("");
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  async function act(data: unknown, done: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/staff/team", data);
      setCreating(null);
      setResetting(null);
      setNotice(done);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!team)
    return (
      <p role="status" className="staff-muted">
        {error || "Loading the team…"}
      </p>
    );
  return (
    <div className="team">
      <h2>Team.</h2>
      <p className="staff-muted">
        The owner’s sign-in sees every chair. A barber’s sign-in shows only
        their own diary, walk-ins, breaks and figures. One sign-in per chair.
      </p>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="staff-muted" role="status">
          {notice}
        </p>
      )}
      <div className="team-list">
        {team.map(({ barber, account }) => (
          <article className="team-row" key={barber.id}>
            <div className="team-name">
              <strong>{barber.name}</strong>
              <span>{barber.role_label}</span>
            </div>
            <div className="team-account">
              {account ? (
                <>
                  <span>{account.email}</span>
                  <small>
                    {account.role === "owner"
                      ? "Owner, sees everything"
                      : account.active
                        ? "Active"
                        : "Switched off"}
                    {account.last_sign_in
                      ? ` · last signed in ${new Date(account.last_sign_in).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}`
                      : " · never signed in"}
                  </small>
                </>
              ) : (
                <span className="staff-muted">No sign-in yet</span>
              )}
            </div>
            <div className="team-actions">
              {!account && (
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => {
                    setResetting(null);
                    setCreating(barber.id);
                  }}
                >
                  Create sign-in
                </button>
              )}
              {account && account.role !== "owner" && (
                <>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        {
                          action: "active",
                          user_id: account.user_id,
                          active: !account.active,
                        },
                        account.active
                          ? `${barber.name}’s sign-in is switched off.`
                          : `${barber.name}’s sign-in is back on.`,
                      )
                    }
                  >
                    {account.active ? "Switch off" : "Switch on"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setCreating(null);
                      setResetting(account.user_id);
                    }}
                  >
                    Reset password
                  </button>
                </>
              )}
              {account?.role === "owner" && (
                <span className="staff-muted">You</span>
              )}
            </div>
            {creating === barber.id && (
              <form
                className="staff-form inline-editor team-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void act(
                    {
                      action: "create",
                      barber_id: barber.id,
                      email: form.get("email"),
                      password: form.get("password"),
                    },
                    `${barber.name} can now sign in. Tell them the email and temporary password; they can change it in their Account tab.`,
                  );
                }}
              >
                <p className="wide editor-title">A sign-in for {barber.name}</p>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                  />
                </label>
                <label>
                  Temporary password (at least 8 characters)
                  <input
                    name="password"
                    type="text"
                    required
                    minLength={8}
                    autoComplete="off"
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="button-primary"
                    disabled={busy}
                  >
                    Create sign-in
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setCreating(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {account && resetting === account.user_id && (
              <form
                className="staff-form inline-editor team-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void act(
                    {
                      action: "password",
                      user_id: account.user_id,
                      password: form.get("password"),
                    },
                    `${barber.name}’s password is reset. Tell them the new one.`,
                  );
                }}
              >
                <p className="wide editor-title">
                  New password for {barber.name}
                </p>
                <label className="wide">
                  New password (at least 8 characters)
                  <input
                    name="password"
                    type="text"
                    required
                    minLength={8}
                    autoComplete="off"
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="button-primary"
                    disabled={busy}
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setResetting(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
