import type { Metadata, Viewport } from "next";
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

// Edge to edge on iPhone, so the safe-area insets around the notch and home bar apply.
// Merged key by key with the root layout's viewport, which keeps its theme colour.
export const viewport: Viewport = {
  viewportFit: "cover",
};

// Applies a saved Light or Dark choice before anything paints. "With the phone" leaves the attribute off.
const THEME_BOOT = `document.documentElement.dataset.staffPage="1";try{var t=localStorage.getItem("symmetry-staff-theme");if(t==="dark"||t==="light")document.documentElement.dataset.staffTheme=t}catch(e){}`;

export default function Page() {
  return (
    <main id="main-content" tabIndex={-1} className="staff-page">
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <StaffApp />
    </main>
  );
}
