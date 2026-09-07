import { z } from "zod";
export const DRAFT_KEY = "symmetry-booking-draft-v1";
const trim = z.object({
  date: z.iso.date(),
  barber: z.enum(["sean", "travis", "dylan"]),
  service: z.string().min(1).max(40),
  time: z.number().int().min(0).max(1439),
  price: z.number().min(0).max(1000),
  duration: z.number().int().min(5).max(480),
});
const schema = z.object({
  savedAt: z.number(),
  basket: z.array(trim).min(1).max(12),
});
export type SavedDraft = z.infer<typeof schema>;
export function readDraft(
  value: string | null,
  now = Date.now(),
): SavedDraft | null {
  try {
    const result = schema.safeParse(JSON.parse(value || "null"));
    if (
      !result.success ||
      result.data.savedAt > now ||
      now - result.data.savedAt > 2 * 60 * 60 * 1000
    )
      return null;
    return result.data;
  } catch {
    return null;
  }
}
export function encodeDraft(
  basket: SavedDraft["basket"],
  now = Date.now(),
): string {
  // Schema strips notes, contact information, tokens and any accidental extra fields.
  return JSON.stringify(schema.parse({ savedAt: now, basket }));
}
