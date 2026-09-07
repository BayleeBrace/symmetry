import type { Metadata } from "next";
import { BrandHeader } from "@/components/brand-header";
import { getCatalog, getPolicy } from "@/lib/catalog";
import { BookingFlow } from "./booking-flow";
import { addDays, BarberChoice, BARBERS, isOpen, shopToday } from "@/lib/booking-data";

export const metadata: Metadata = {
  title: "Book a Trim",
  description: "Choose Sean, Travis or Dylan and book your next trim at Symmetry Barbers in Saundersfoot.",
  alternates: { canonical: "/book" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Book a Trim | Symmetry Saundersfoot",
    description: "Choose your barber, service and time at Symmetry Barbers in Saundersfoot.",
    url: "/book",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a Trim | Symmetry Saundersfoot",
    description: "Choose your barber, service and time.",
  },
};
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ barber?: string; service?: string }> }) {
  const { barber, service } = await searchParams;
  const catalog = await getCatalog(); const policy = await getPolicy();
  const initialBarber: BarberChoice = barber && barber in BARBERS ? barber as keyof typeof BARBERS : "sean";
  let firstDate = shopToday();
  while (!isOpen(firstDate)) firstDate = addDays(firstDate, 1);
  return (
    <main className="app-shell">
      <BrandHeader compact />
      <BookingFlow initialDate={firstDate} initialBarber={initialBarber} initialService={service} catalog={catalog} policy={policy} />
    </main>
  );
}
