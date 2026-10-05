import { distanceKm, type LatLng } from "./geo";
import type { CategoryId, Member, PlaceView, Snapshot, Status } from "./types";

export type StatusFilter = Status | "unsaved";

export interface Filters {
  q: string;
  categories: CategoryId[];
  /** Applies to MY status. "unsaved" = places friends saved that I haven't. */
  statuses: StatusFilter[];
  addedBy: string[];
  maxKm: number | null;
  /** Saved by at least this many people (the "popular" chip). */
  minSavers: number;
}

export const EMPTY_FILTERS: Filters = { q: "", categories: [], statuses: [], addedBy: [], maxKm: null, minSavers: 0 };

export type SortKey = "newest" | "name" | "distance" | "popular" | "rating";

export function buildViews(s: Snapshot, meId: string, here: LatLng | null): PlaceView[] {
  const memberById = new Map<string, Member>(s.members.map((m) => [m.id, m]));
  const byPlace = new Map<string, Snapshot["statuses"]>();
  for (const st of s.statuses) {
    const list = byPlace.get(st.place_id) ?? [];
    list.push(st);
    byPlace.set(st.place_id, list);
  }
  return s.places.map((p) => {
    const savers = byPlace.get(p.id) ?? [];
    const ratings = savers.map((x) => x.rating).filter((r): r is number => r != null);
    return {
      ...p,
      addedBy: (p.created_by && memberById.get(p.created_by)) || null,
      savers,
      mine: savers.find((x) => x.user_id === meId) ?? null,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      distanceKm: here ? distanceKm(here, p) : null,
    };
  });
}

export function applyFilters(views: PlaceView[], f: Filters): PlaceView[] {
  const q = f.q.trim().toLowerCase();
  return views.filter((v) => {
    if (q && !`${v.name} ${v.area ?? ""} ${v.address ?? ""} ${v.note ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.categories.length && !f.categories.includes(v.category)) return false;
    if (f.statuses.length) {
      const mine: StatusFilter = v.mine?.status ?? "unsaved";
      if (!f.statuses.includes(mine)) return false;
    }
    if (f.addedBy.length && !(v.created_by && f.addedBy.includes(v.created_by))) return false;
    if (f.maxKm != null && (v.distanceKm == null || v.distanceKm > f.maxKm)) return false;
    if (f.minSavers && v.savers.length < f.minSavers) return false;
    return true;
  });
}

export function sortViews(views: PlaceView[], key: SortKey): PlaceView[] {
  const out = [...views];
  switch (key) {
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    case "distance":
      return out.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    case "popular":
      return out.sort((a, b) => b.savers.length - a.savers.length || b.created_at.localeCompare(a.created_at));
    case "rating":
      return out.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
    default:
      return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

export function activeFilterCount(f: Filters): number {
  return (
    f.categories.length + f.statuses.length + f.addedBy.length + (f.maxKm != null ? 1 : 0) + (f.minSavers ? 1 : 0)
  );
}
