"use client";

import { MapPinned, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AddFab } from "@/components/AppShell";
import { FilterSheet } from "@/components/FilterSheet";
import { Avatar, CategoryIcon, Chip, cx, EmptyState, Stars, StatusDot } from "@/components/ui";
import { CATEGORIES, CATEGORY_BY_ID, STATUS_BY_ID, STATUSES } from "@/lib/categories";
import { activeFilterCount, applyFilters, EMPTY_FILTERS, sortViews, type SortKey } from "@/lib/filters";
import { formatKm } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { PlaceView, Status } from "@/lib/types";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "popular", label: "Most saved" },
  { id: "rating", label: "Top rated" },
  { id: "name", label: "A–Z" },
  { id: "distance", label: "Nearest" },
];

export default function PlacesPage() {
  const { views, filtered, filters, setFilters, select, selectedId, here, locate, me } = useStore();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const rows = useMemo(() => sortViews(filtered, sort), [filtered, sort]);

  // Category counts reflect every other filter, so they answer "how many if I tap this?"
  const categoryCounts = useMemo(() => {
    const base = applyFilters(views, { ...filters, categories: [] });
    const counts = new Map<string, number>();
    for (const v of base) counts.set(v.category, (counts.get(v.category) ?? 0) + 1);
    return counts;
  }, [views, filters]);

  const singleStatus = filters.statuses.length === 1 ? filters.statuses[0] : null;
  const setStatusChip = (s: Status | null) => setFilters((f) => ({ ...f, statuses: s ? [s] : [], minSavers: 0 }));
  const extra = activeFilterCount(filters);
  const mineCount = views.filter((v) => v.mine).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold md:text-3xl">Places</h1>
            <p className="text-sm text-muted">
              {views.length} saved by the group · {mineCount} on your list
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5 focus-within:border-ink">
            <Search size={18} className="text-muted" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search name, area, note…"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none"
            />
            {filters.q && (
              <button type="button" aria-label="Clear search" onClick={() => setFilters((f) => ({ ...f, q: "" }))}>
                <X size={18} className="text-muted" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={cx(
              "relative grid w-11 place-items-center rounded-xl border",
              extra ? "border-ink bg-ink text-white" : "border-line bg-white",
            )}
            aria-label="Filters"
          >
            <SlidersHorizontal size={18} />
            {extra > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {extra}
              </span>
            )}
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Chip active={!filters.statuses.length && !filters.minSavers} onClick={() => setStatusChip(null)}>
            All
          </Chip>
          {STATUSES.map((s) => (
            <Chip key={s.id} active={singleStatus === s.id} onClick={() => setStatusChip(singleStatus === s.id ? null : s.id)}>
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.id === "want" ? "Want" : s.label}
            </Chip>
          ))}
          <Chip
            active={filters.minSavers >= 2}
            onClick={() => setFilters((f) => ({ ...f, minSavers: f.minSavers >= 2 ? 0 : 2 }))}
          >
            <Users size={14} /> Popular
          </Chip>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {CATEGORIES.map((c) => {
            const active = filters.categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    categories: active ? f.categories.filter((x) => x !== c.id) : [...f.categories, c.id],
                  }))
                }
                className={cx(
                  "flex flex-col items-center rounded-xl border px-1 py-2 transition-colors",
                  active ? "border-transparent text-white" : "border-line bg-white hover:border-ink/30",
                )}
                style={active ? { background: c.color } : undefined}
              >
                <c.Icon size={18} style={active ? undefined : { color: c.color }} />
                <span className="mt-0.5 text-base font-extrabold">{categoryCounts.get(c.id) ?? 0}</span>
                <span className={cx("text-[11px] font-semibold", active ? "text-white/90" : "text-muted")}>{c.short}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-muted">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </span>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-muted">Sort</span>
            <select
              value={sort}
              onChange={async (e) => {
                const next = e.target.value as SortKey;
                if (next === "distance" && !here && !(await locate())) return;
                setSort(next);
              }}
              className="rounded-lg border border-line bg-white px-2 py-1 font-semibold"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          views.length === 0 ? (
            <EmptyState
              icon={<MapPinned />}
              title="No places yet"
              body="Add the first place your group wants to try."
              action={<AddFab />}
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title="Nothing matches"
              body="Try a different search or fewer filters."
              action={
                <button className="font-semibold text-accent underline" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear all filters
                </button>
              }
            />
          )
        ) : (
          <>
            {/* Phone: cards */}
            <ul className="overflow-hidden rounded-2xl border border-line bg-white md:hidden">
              {rows.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => select(p.id)}
                    className={cx(
                      "flex w-full items-center gap-3 border-b border-line px-3.5 py-3 text-left last:border-0",
                      selectedId === p.id && "bg-paper",
                    )}
                  >
                    <CategoryIcon id={p.category} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{p.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {[p.area, p.distanceKm != null ? formatKm(p.distanceKm) : null].filter(Boolean).join(" · ") || CATEGORY_BY_ID[p.category].label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        Added by {p.addedBy?.id === me?.id ? "you" : (p.addedBy?.name ?? "former member")}
                        {p.savers.length >= 2 && ` · ${p.savers.length} saved`}
                      </span>
                    </span>
                    <StatusDot status={p.mine?.status} className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-paper/60 text-xs font-bold tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3">Place</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Area</th>
                    <th className="px-4 py-3">Added by</th>
                    <th className="px-4 py-3">Saved</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">My status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <Row key={p.id} p={p} selected={selectedId === p.id} onClick={() => select(p.id)} meId={me?.id} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[500] md:hidden">
        <AddFab />
      </div>
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}

function Row({ p, selected, onClick, meId }: { p: PlaceView; selected: boolean; onClick: () => void; meId?: string }) {
  const c = CATEGORY_BY_ID[p.category];
  return (
    <tr
      onClick={onClick}
      className={cx("cursor-pointer border-b border-line last:border-0 hover:bg-paper/60", selected && "bg-paper")}
    >
      <td className="px-4 py-3">
        <div className="font-bold">{p.name}</div>
        {p.distanceKm != null && <div className="text-xs text-muted">{formatKm(p.distanceKm)} away</div>}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: c.color }}>
          <c.Icon size={15} /> {c.label}
        </span>
      </td>
      <td className="px-4 py-3 text-muted">{p.area ?? "—"}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2">
          <Avatar member={p.addedBy} size={22} />
          {p.addedBy?.id === meId ? "You" : (p.addedBy?.name ?? "—")}
        </span>
      </td>
      <td className="px-4 py-3">{p.savers.length}</td>
      <td className="px-4 py-3">{p.avgRating != null ? <Stars value={p.avgRating} size={13} /> : <span className="text-muted">—</span>}</td>
      <td className="px-4 py-3">
        {p.mine ? (
          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: STATUS_BY_ID[p.mine.status].color }}>
            <StatusDot status={p.mine.status} /> {STATUS_BY_ID[p.mine.status].label}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
}
