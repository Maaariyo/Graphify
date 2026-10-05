"use client";

import { Users } from "lucide-react";
import { CATEGORIES, STATUSES } from "@/lib/categories";
import { EMPTY_FILTERS, type Filters, type StatusFilter } from "@/lib/filters";
import { useStore } from "@/lib/store";
import { Sheet } from "./Sheet";
import { Avatar, Button, Chip, SectionLabel } from "./ui";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

const DISTANCES: { label: string; km: number | null }[] = [
  { label: "Anywhere", km: null },
  { label: "< 5 km", km: 5 },
  { label: "< 10 km", km: 10 },
  { label: "< 25 km", km: 25 },
];

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filters, setFilters, filtered, data, here, locate } = useStore();
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filter"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setFilters({ ...EMPTY_FILTERS, q: filters.q })}>
            Clear
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Show {filtered.length} place{filtered.length === 1 ? "" : "s"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 px-5 pb-5">
        <div>
          <SectionLabel>Category</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                active={filters.categories.includes(c.id)}
                color={c.color}
                onClick={() => update({ categories: toggle(filters.categories, c.id) })}
              >
                <c.Icon size={15} /> {c.short}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>My status</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {[...STATUSES, { id: "unsaved" as const, label: "Not on my list", color: "#868e96" }].map((s) => (
              <Chip
                key={s.id}
                active={filters.statuses.includes(s.id)}
                onClick={() => update({ statuses: toggle<StatusFilter>(filters.statuses, s.id) })}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Added by</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <Chip active={filters.addedBy.length === 0} onClick={() => update({ addedBy: [] })}>
              Anyone
            </Chip>
            {data?.members.map((m) => (
              <Chip key={m.id} active={filters.addedBy.includes(m.id)} onClick={() => update({ addedBy: toggle(filters.addedBy, m.id) })}>
                <Avatar member={m} size={18} /> {m.name}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Distance from me</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {DISTANCES.map((d) => (
              <Chip
                key={d.label}
                active={filters.maxKm === d.km}
                onClick={async () => {
                  if (d.km != null && !here && !(await locate())) return;
                  update({ maxKm: d.km });
                }}
              >
                {d.label}
              </Chip>
            ))}
          </div>
          {!here && <p className="mt-2 text-xs text-muted">Picking a distance asks for your location.</p>}
        </div>

        <div>
          <SectionLabel>Popular</SectionLabel>
          <Chip active={filters.minSavers >= 2} onClick={() => update({ minSavers: filters.minSavers >= 2 ? 0 : 2 })}>
            <Users size={15} /> Saved by 2+ friends
          </Chip>
        </div>
      </div>
    </Sheet>
  );
}
