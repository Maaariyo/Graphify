import { distanceKm, type LatLng } from "./geo";
import type { PlaceView } from "./types";

// Words that don't identify a place: "Cafe Delhi Heights" and "Delhi Heights" are the same spot.
const FILLER = new Set(["the", "a", "an", "and", "of", "cafe", "café", "restaurant", "bar", "kitchen", "eatery"]);

export function nameTokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !FILLER.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)); // Gardens → garden
}

/** True when one name is the other plus extra words ("Blue Tokai" vs "Blue Tokai, Champa Gali"), or they mostly overlap. */
export function similarNames(a: string, b: string): boolean {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (!ta.size || !tb.size) return false;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  const shared = [...small].filter((t) => big.has(t)).length;
  const contained = shared === small.size && [...small].join("").length >= 4;
  const jaccard = shared / (ta.size + tb.size - shared);
  return contained || jaccard >= 0.6;
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  return url.trim().replace(/^https?:\/\//, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}

export interface DuplicateMatch {
  place: PlaceView;
  reason: string;
}

/**
 * Places the group probably already saved. Ordered strongest first.
 * - same Google Maps link, or practically the same pin (< 30 m)
 * - similar name within 2 km
 * - identical name anywhere (before a location is set, this is the only check)
 */
export function findDuplicates(
  views: PlaceView[],
  candidate: { name: string; at: LatLng | null; source_url: string | null },
  excludeId?: string,
): DuplicateMatch[] {
  const url = normalizeUrl(candidate.source_url);
  const tokens = nameTokens(candidate.name).join(" ");
  const out: (DuplicateMatch & { score: number })[] = [];
  for (const v of views) {
    if (v.id === excludeId) continue;
    const km = candidate.at ? distanceKm(v, candidate.at) : null;
    const sameName = tokens.length >= 3 && nameTokens(v.name).join(" ") === tokens;
    if (url && normalizeUrl(v.source_url) === url) out.push({ place: v, reason: "same Google Maps link", score: 0 });
    else if (km != null && km < 0.03) out.push({ place: v, reason: "same spot on the map", score: 1 });
    else if (km != null && km < 2 && candidate.name.trim() && similarNames(candidate.name, v.name))
      out.push({ place: v, reason: `similar name, ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away`, score: 2 + km });
    else if (sameName) out.push({ place: v, reason: "same name", score: 5 });
  }
  return out.sort((a, b) => a.score - b.score).map(({ place, reason }) => ({ place, reason }));
}
