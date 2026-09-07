// Best-effort protection for unconnected previews. Each server instance has its
// own window; this is not a substitute for the shared database limiter or WAF.
export function createMemoryLimiter(maxKeys = 10000) {
  const windows = new Map<string, { hits: number[]; expires: number }>();
  return (key: string, limit: number, seconds: number, now = Date.now()) => {
    for (const [id, entry] of windows)
      if (entry.expires <= now) windows.delete(id);
    const since = now - seconds * 1000;
    const entry = windows.get(key) || {
      hits: [],
      expires: now + seconds * 1000,
    };
    entry.hits = entry.hits.filter((at) => at > since);
    if (entry.hits.length >= limit) return false;
    if (!windows.has(key) && windows.size >= maxKeys) return false;
    entry.hits.push(now);
    entry.expires = now + seconds * 1000;
    windows.set(key, entry);
    return true;
  };
}
