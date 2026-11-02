/**
 * PostgREST hands back at most 1000 rows a request (Supabase's max rows), so
 * a plain query quietly stops there. This asks for one page at a time with
 * .range() until a short page comes back, up to `max` rows in all.
 *
 * `page` must build a fresh query each call, ordered by something unique
 * (end with .order("id")) so no row is skipped or repeated between pages.
 */
export async function fetchAll<T, E>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: E | null }>,
  { size = 1000, max = 50000 }: { size?: number; max?: number } = {},
): Promise<{ data: T[]; error: E | null }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, Math.min(from + size, max) - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return { data: rows, error: null };
}
