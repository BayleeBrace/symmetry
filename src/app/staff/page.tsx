import type { Metadata } from "next";
import "./staff.css";
import { StaffApp } from "./app";

// The staff area is its own home-screen app: it opens at /staff and stays there.
export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
  manifest: "/staff.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Symmetry staff",
    statusBarStyle: "default",
  },
};

export default function Page() {
  return (
    <main className="staff-page">
      <StaffApp />
    </main>
  );
}
