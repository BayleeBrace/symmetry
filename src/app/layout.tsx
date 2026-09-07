import { shopDescription } from "@/lib/brand-copy";
import type { Metadata, Viewport } from "next";
import { brandSans, brandSerif } from "./fonts";
import "./globals.css";
import { shopContact } from "@/lib/shop-contact";
import { AppRegistration } from "@/components/app-registration";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL("https://symmetrywales.com"),
    title: {
      default: "Symmetry Barbers Saundersfoot | Cuts, Fades & Beards",
      template: "%s | Symmetry Barbers",
    },
    description: shopDescription(),
    applicationName: "Symmetry",
    category: "barbers",
    keywords: [
      "barbers Saundersfoot",
      "barber Saundersfoot",
      "skin fade Saundersfoot",
      "haircut Saundersfoot",
      "barbers Pembrokeshire",
      "beard trim Saundersfoot",
      "Symmetry Barbers",
    ],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "en_GB",
      url: "/",
      siteName: "Symmetry Barbers",
      title: "Symmetry Barbers Saundersfoot",
      description:
        "Cuts, fades and beards in Saundersfoot, Pembrokeshire. Same chairs. New name.",
    },
    twitter: {
      card: "summary_large_image",
      title: "Symmetry Barbers Saundersfoot",
      description: "Cuts, fades and beards in Saundersfoot, Pembrokeshire.",
    },
    appleWebApp: {
      capable: true,
      title: "Symmetry",
      statusBarStyle: "black-translucent",
    },
    icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
    formatDetection: { address: false, email: false, telephone: false },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
    other: {
      "geo.region": "GB-PEM",
      "geo.placename": "Saundersfoot",
    },
  };
}
export const viewport: Viewport = {
  themeColor: "#161616",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": "https://symmetrywales.com/#barbers",
    name: "Symmetry Barbers",
    alternateName: "Studio 4 Barbers",
    url: "https://symmetrywales.com/",
    image: "https://symmetrywales.com/images/shop-hero.jpg",
    description:
      "Independent barbers in Saundersfoot offering cuts, skin fades and beard trims.",
    priceRange: "£8–£27",
    telephone: shopContact.phone || undefined,
    email: shopContact.email || undefined,
    hasMap: shopContact.mapUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: "4 Brewery Terrace",
      addressLocality: "Saundersfoot",
      addressRegion: "Pembrokeshire",
      postalCode: "SA69 9HG",
      addressCountry: "GB",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Tuesday",
        opens: "09:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Wednesday", "Thursday"],
        opens: "11:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Friday",
        opens: "09:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "08:00",
        closes: "15:00",
      },
    ],
    sameAs: ["https://www.instagram.com/symmetry.wales/"],
  };

  return (
    <html lang="en-GB">
      <body className={`${brandSans.variable} ${brandSerif.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusiness).replace(/</g, "\\u003c"),
          }}
        />
        <a href="#main-content" className="skip-link">
          skip to content
        </a>
        <AppRegistration />
        {children}
      </body>
    </html>
  );
}
