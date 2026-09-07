import localFont from "next/font/local";

export const brandSerif = localFont({
  src: "../../public/fonts/brand-0.woff2",
  variable: "--font-serif",
  weight: "300",
  display: "swap",
});

export const brandSans = localFont({
  src: [
    { path: "../../public/fonts/brand-1.woff2", weight: "300" },
    { path: "../../public/fonts/brand-2.woff2", weight: "400" },
  ],
  variable: "--font-sans",
  display: "swap",
});
