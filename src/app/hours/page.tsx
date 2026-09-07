import type { Metadata } from "next";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Hours & location" };

const hours = [
  ["monday", "closed"], ["tuesday", "09:00 — 18:00"], ["wednesday", "11:00 — 19:00"],
  ["thursday", "11:00 — 19:00"], ["friday", "09:00 — 18:00"], ["saturday", "08:00 — 15:00"], ["sunday", "closed"],
];

export default function HoursPage() {
  return (
    <main className="information-page">
      <BrandHeader />
      <section className="hours-page-grid">
        <div>
          <p className="eyebrow">saundersfoot, pembrokeshire</p>
          <h1>come by.</h1>
          <p>4 Brewery Terrace<br />Saundersfoot<br />SA69 9HG</p>
          <p>Use the shared entrance and look for Symmetry inside.</p>
          <a className="text-link" href="https://maps.google.com/?q=4+Brewery+Terrace+Saundersfoot+SA69+9HG" target="_blank" rel="noreferrer">open in maps</a>
        </div>
        <div className="hours-list large">
          {hours.map(([day, time]) => <div className={time === "closed" ? "closed" : ""} key={day}><span>{day}</span><time>{time}</time></div>)}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
