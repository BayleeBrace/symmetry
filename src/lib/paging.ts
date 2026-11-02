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

/**
 * Runs `run` over a long list of ids a slice at a time. PostgREST puts an
 * .in() filter in the request URL, and a few hundred uuids make that URL too
 * long for the server, so the list is split and the answers joined. Each id
 * lands in exactly one slice, so anything ordered per id stays in order.
 */
export async function forChunks<T, E>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: T[]; error: E | null }>,
  size = 150,
): Promise<{ data: T[]; error: E | null }> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await run(ids.slice(i, i + size));
    if (error) return { data: rows, error };
    rows.push(...data);
  }
  return { data: rows, error: null };
}
