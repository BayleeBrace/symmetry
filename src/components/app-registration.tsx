"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function AppRegistration() {
  const path = usePathname();
  useEffect(() => {
    if (
      /^\/(book|bookings|staff|waitlist)(\/|$)/.test(path) &&
      "serviceWorker" in navigator
    )
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [path]);
  return null;
}
