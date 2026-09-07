import type { Metadata, Viewport } from "next";
import { brandSans, brandSerif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://symmetrywales.com"),
  title: { default: "Symmetry — Barbers, Saundersfoot", template: "%s — Symmetry" },
  description: "Book a trim with Symmetry in Saundersfoot.",
  applicationName: "Symmetry",
  appleWebApp: { capable: true, title: "Symmetry", statusBarStyle: "black-translucent" },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#161616", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB">
      <body className={`${brandSans.variable} ${brandSerif.variable}`}>{children}</body>
    </html>
  );
}
