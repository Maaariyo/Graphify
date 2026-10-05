"use client";

import { LocateFixed, Search, SlidersHorizontal, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { AddFab } from "@/components/AppShell";
import { FilterSheet } from "@/components/FilterSheet";
import { Logo } from "@/components/Logo";
import { Avatar, CategoryIcon, Chip, cx } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { activeFilterCount, EMPTY_FILTERS } from "@/lib/filters";
import type { LatLng } from "@/lib/geo";
import { useStore } from "@/lib/store";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#eceae4]" />,
});

export default function MapPage() {
  const { filtered, views, filters, setFilters, selectedId, select, here, locate, setEditor, me } = useStore();
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const onSelect = useCallback((id: string | null) => select(id), [select]);
  const onLongPress = useCallback((at: LatLng) => setEditor({ mode: "add", initial: at }), [setEditor]);

  const q = filters.q.trim().toLowerCase();
  const matches = q ? filtered.slice(0, 6) : [];
  const extraFilters = activeFilterCount(filters) - filters.categories.length;
  const onlyCategory = (id: (typeof CATEGORIES)[number]["id"]) =>
    setFilters((f) => ({ ...f, categories: f.categories.length === 1 && f.categories[0] === id ? [] : [id] }));

  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0">
        <MapView places={filtered} selectedId={selectedId} here={here} onSelect={onSelect} onLongPress={onLongPress} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 md:p-4">
        <div className="pointer-events-auto mx-auto max-w-xl md:mx-0">
          <div className="mb-2 flex items-center justify-between md:hidden">
            <Logo className="rounded-full bg-white/90 py-1 pr-3 pl-1 text-base shadow-sm backdrop-blur" />
            <Link href="/friends" aria-label="Profile" className="rounded-full bg-white p-0.5 shadow-sm">
              <Avatar member={me} size={32} />
            </Link>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 shadow-lg shadow-ink/10">
              <Search size={18} className="shrink-0 text-muted" />
              <input
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Search our places…"
                className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
                inputMode="search"
              />
              {filters.q && (
                <button type="button" aria-label="Clear search" onClick={() => setFilters((f) => ({ ...f, q: "" }))}>
                  <X size={18} className="text-muted" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className={cx(
                  "relative -mr-1.5 grid h-9 w-9 place-items-center rounded-xl",
                  extraFilters ? "bg-ink text-white" : "hover:bg-paper",
                )}
                aria-label="Filters"
              >
                <SlidersHorizontal size={18} />
                {extraFilters > 0 && (
                  <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {extraFilters}
                  </span>
                )}
              </button>
            </div>

            {searchFocused && q && (
              <ul className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl bg-white shadow-lg">
                {matches.length === 0 && <li className="px-4 py-3 text-sm text-muted">No saved place matches “{filters.q}”.</li>}
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        select(p.id);
                        setSearchFocused(false);
                      }}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-paper"
                    >
                      <CategoryIcon id={p.category} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                        <span className="block truncate text-xs text-muted">{p.area}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="no-scrollbar -mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:px-0">
            <Chip
              active={filters.categories.length === 0}
              onClick={() => setFilters((f) => ({ ...f, categories: [] }))}
              className="shadow-sm"
            >
              All
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                active={filters.categories.includes(c.id)}
                color={c.color}
                onClick={() => onlyCategory(c.id)}
                className="shadow-sm"
              >
                <c.Icon size={15} style={filters.categories.includes(c.id) ? undefined : { color: c.color }} />
                {c.short}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {views.length === 0 ? (
        <MapNotice
          title="Your map is empty"
          body="Tap + to add the first place. Tip: long-press (or right-click) the map to drop a pin right there."
        />
      ) : filtered.length === 0 ? (
        <MapNotice
          title="No places match"
          body="Try fewer filters."
          action={
            <button className="font-semibold text-accent underline" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear all filters
            </button>
          }
        />
      ) : null}

      <div className="absolute right-3 bottom-4 z-[500] flex flex-col items-end gap-3 md:right-4">
        <button
          type="button"
          aria-label="Show my location"
          onClick={() => void locate()}
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-lg shadow-ink/15"
        >
          <LocateFixed size={20} />
        </button>
        <AddFab className="md:hidden" />
      </div>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}

function MapNotice({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[500] flex justify-center px-4 md:bottom-8">
      <div className="pointer-events-auto max-w-sm rounded-2xl bg-white px-5 py-4 text-center shadow-xl">
        <div className="font-bold">{title}</div>
        <p className="mt-1 text-sm text-muted">{body}</p>
        {action && <div className="mt-2 text-sm">{action}</div>}
      </div>
    </div>
  );
}
