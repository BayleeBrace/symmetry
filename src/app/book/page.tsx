import type { Metadata } from "next";
import { BrandHeader } from "@/components/brand-header";
import { BookingFlow } from "./booking-flow";
import { addDays, isOpen, shopToday } from "@/lib/booking-data";

export const metadata: Metadata = { title: "Book a trim", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function BookPage() {
  let firstDate = shopToday();
  while (!isOpen(firstDate)) firstDate = addDays(firstDate, 1);
  return (
    <main className="app-shell">
      <BrandHeader compact />
      <BookingFlow initialDate={firstDate} />
    </main>
  );
}
