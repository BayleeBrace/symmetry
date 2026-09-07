import type { Metadata } from "next";
import { BrandHeader } from "@/components/brand-header";

export const metadata: Metadata = { title: "For the lads", robots: { index: false, follow: false } };

const barbers = [
  ["sean", "owner · all three chairs"],
  ["travis", "your chair and your week"],
  ["dylan", "your chair and your week"],
];

export default function StaffPage() {
  return <main className="staff-page"><BrandHeader compact /><section className="staff-content"><p className="eyebrow">FOR THE LADS</p><h1>your day.</h1><p>This is where the live diary, walk-ins, breaks and running-late updates will sit. Staff sign-in is the next connected slice.</p><div className="staff-grid">{barbers.map(([name, description]) => <article className="staff-card" key={name}><h2>{name}.</h2><p>{description}</p><span>diary coming next →</span></article>)}</div></section></main>;
}
