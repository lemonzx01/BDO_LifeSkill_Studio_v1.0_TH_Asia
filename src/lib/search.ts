/**
 * Name search that puts the item you meant first: an exact name, then names
 * that start with the query, then shorter names, then anything containing it.
 * "น้ำบริสุทธิ์" must return Purified Water before forty kinds of "น้ำบริสุทธิ์แห่ง…".
 */
export function rankByName<T extends { th: string; en?: string | null }>(items: readonly T[], query: string, limit = 12): T[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const scored: { item: T; score: number; len: number }[] = [];
  for (const item of items) {
    const th = item.th.toLowerCase();
    const en = (item.en ?? "").toLowerCase();
    let score: number;
    if (th === q || en === q) score = 0;
    else if (th.startsWith(q) || en.startsWith(q)) score = 1;
    else if (th.includes(q) || en.includes(q)) score = 2;
    else continue;
    scored.push({ item, score, len: th.length });
  }
  scored.sort((a, b) => a.score - b.score || a.len - b.len);
  return scored.slice(0, limit).map((s) => s.item);
}
