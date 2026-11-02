/**
 * "Remember my details on this phone": the customer's name, email and mobile,
 * kept only in this browser's local storage so the next booking is quicker.
 * Never marketing permission, notes or the policy tick, which are asked
 * afresh each time. Forgotten after a year, or whenever the customer asks.
 */
export const REMEMBER_KEY = "symmetry.details";
const YEAR = 365 * 86400000;

export type RememberedDetails = {
  name: string;
  email: string;
  country: string;
  phone: string;
};

export function encodeRemembered(details: RememberedDetails, now = Date.now()) {
  const { name, email, country, phone } = details;
  return JSON.stringify({ v: 1, savedAt: now, name, email, country, phone });
}

/** The saved details, or null when there are none or they don't look right. */
export function readRemembered(
  raw: string | null,
  now = Date.now(),
): RememberedDetails | null {
  if (!raw || raw.length > 2000) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d.v !== 1 || typeof d.savedAt !== "number") return null;
    if (now - d.savedAt > YEAR) return null;
    const text = (key: string, max: number) =>
      typeof d[key] === "string" && (d[key] as string).length <= max
        ? (d[key] as string)
        : null;
    const name = text("name", 100),
      email = text("email", 254),
      country = text("country", 2),
      phone = text("phone", 30);
    if (name === null || email === null || country === null || phone === null)
      return null;
    if (!/^[A-Z]{2}$/.test(country)) return null;
    return { name, email, country, phone };
  } catch {
    return null;
  }
}
