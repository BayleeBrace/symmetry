import type { Metadata } from "next";
import { BrandHeader } from "@/components/brand-header";
import { BookingFlow } from "./booking-flow";
import { addDays, BarberChoice, BARBERS, isOpen, shopToday } from "@/lib/booking-data";

export const metadata: Metadata = { title: "Book a trim", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ barber?: string }> }) {
  const { barber } = await searchParams;
  const initialBarber: BarberChoice = barber && barber in BARBERS ? barber as keyof typeof BARBERS : "sean";
  let firstDate = shopToday();
  while (!isOpen(firstDate)) firstDate = addDays(firstDate, 1);
  return (
    <main className="app-shell">
      <BrandHeader compact />
      <BookingFlow initialDate={firstDate} initialBarber={initialBarber} />
    </main>
  );
}
