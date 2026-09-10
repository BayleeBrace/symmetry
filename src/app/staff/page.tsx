import "./staff.css";
import { StaffApp } from "./app";
export const metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="staff-page">
      <StaffApp />
    </main>
  );
}
