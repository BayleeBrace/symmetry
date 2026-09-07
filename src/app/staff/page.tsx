import "./staff.css";
import { BrandHeader } from "@/components/brand-header";
import { Diary } from "./diary";
export const metadata = {
  title: "Staff diary",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="staff-page">
      <BrandHeader compact />
      <Diary />
    </main>
  );
}
