"use client";
import { useState } from "react";
export function PushButton({
  token,
  label = "enable notifications",
}: {
  token?: string;
  label?: string;
}) {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        onClick={async () => {
          try {
            if (!("serviceWorker" in navigator) || !("PushManager" in window))
              throw new Error(
                "On iPhone, add the site to your Home Screen first, then open it there.",
              );
            const r = await fetch("/api/push");
            const { key } = await r.json();
            if (!key) throw new Error("Notifications are not enabled yet.");
            const registration =
              await navigator.serviceWorker.register("/sw.js");
            await navigator.serviceWorker.ready;
            const permission = await Notification.requestPermission();
            if (permission !== "granted")
              throw new Error(
                "You can enable notifications in your browser settings.",
              );
            const sub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: key,
            });
            const save = await fetch("/api/push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, subscription: sub }),
            });
            if (!save.ok) throw new Error("Notifications could not be saved");
            setMessage("Notifications enabled.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        {label}
      </button>
      {message && <span role="status">{message}</span>}
    </>
  );
}
