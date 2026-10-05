"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Plus,
  Route,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Button, buttonClass, CategoryIcon, Chip, cx, EmptyState, IconButton, SectionLabel, Stars } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { distanceKm, formatKm, googleMapsPlaceUrl, googleMapsRouteUrl } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { CategoryId, Plan, PlaceView } from "@/lib/types";

function formatDate(date: string | null, long = false) {
  if (!date) return "No date yet";
  return new Date(date + "T00:00").toLocaleDateString("en-IN", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: "short",
  });
}

function nextSaturday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function PlanPage() {
  const { data, run } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const plans = data?.plans ?? [];
  const open = plans.find((p) => p.id === openId);

  if (open) return <PlanEditor plan={open} onBack={() => setOpenId(null)} />;

  const today = todayIso();
  const upcoming = plans.filter((p) => !p.date || p.date >= today).sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9"));
  const past = plans.filter((p) => p.date && p.date < today).sort((a, b) => b.date!.localeCompare(a.date!));

  async function create() {
    const id = await run((r) => r.createPlan("Weekend outing", nextSaturday()));
    if (id) setOpenId(id);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold md:text-3xl">Plans</h1>
            <p className="text-sm text-muted">Turn saved places into an actual outing.</p>
          </div>
          <Button onClick={create}>
            <Plus size={16} /> New plan
          </Button>
        </div>

        {plans.length === 0 ? (
          <EmptyState
            icon={<CalendarDays />}
            title="No plans yet"
            body="Pick a day, pick a vibe, and Wanderlist suggests places the group already saved."
            action={<Button onClick={create}>Plan an outing</Button>}
          />
        ) : (
          <>
            <PlanList title="Upcoming" plans={upcoming} onOpen={setOpenId} />
            <PlanList title="Past" plans={past} onOpen={setOpenId} muted />
          </>
        )}
      </div>
    </div>
  );
}

function PlanList({ title, plans, onOpen, muted }: { title: string; plans: Plan[]; onOpen: (id: string) => void; muted?: boolean }) {
  const { data, views } = useStore();
  if (!plans.length) return null;
  return (
    <div className="mt-6">
      <SectionLabel>{title}</SectionLabel>
      <ul className="space-y-2">
        {plans.map((plan) => {
          const stops = (data?.planPlaces ?? [])
            .filter((pp) => pp.plan_id === plan.id)
            .sort((a, b) => a.position - b.position)
            .map((pp) => views.find((v) => v.id === pp.place_id))
            .filter((v): v is PlaceView => !!v);
          const creator = data?.members.find((m) => m.id === plan.created_by) ?? null;
          return (
            <li key={plan.id}>
              <button
                type="button"
                onClick={() => onOpen(plan.id)}
                className={cx(
                  "w-full rounded-2xl border border-line bg-white p-4 text-left hover:border-ink/30",
                  muted && "opacity-70",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold">{plan.name}</div>
                    <div className="text-sm text-muted">
                      {formatDate(plan.date, true)} · {stops.length} stop{stops.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Avatar member={creator} size={28} />
                </div>
                {stops.length > 0 && (
                  <div className="mt-3 flex -space-x-1">
                    {stops.slice(0, 8).map((s) => (
                      <span key={s.id} className="rounded-xl ring-2 ring-white">
                        <CategoryIcon id={s.category} size="sm" />
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlanEditor({ plan, onBack }: { plan: Plan; onBack: () => void }) {
  const { data, views, run, select, me, isAdmin, toast } = useStore();
  const [name, setName] = useState(plan.name);
  const [vibes, setVibes] = useState<CategoryId[]>([]);
  const [hideVisited, setHideVisited] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const stopIds = useMemo(
    () =>
      (data?.planPlaces ?? [])
        .filter((pp) => pp.plan_id === plan.id)
        .sort((a, b) => a.position - b.position)
        .map((pp) => pp.place_id),
    [data, plan.id],
  );
  const stops = stopIds.map((id) => views.find((v) => v.id === id)).filter((v): v is PlaceView => !!v);
  const anchor = stops[0] ?? null;

  const suggestions = useMemo(() => {
    const inPlan = new Set(stopIds);
    return views
      .filter((v) => !inPlan.has(v.id))
      .filter((v) => !vibes.length || vibes.includes(v.category))
      .filter((v) => !hideVisited || v.mine?.status !== "visited")
      .map((v) => ({ v, km: anchor ? distanceKm(anchor, v) : null }))
      .sort(
        (a, b) =>
          b.v.savers.filter((s) => s.status !== "visited").length - a.v.savers.filter((s) => s.status !== "visited").length ||
          (a.km ?? 0) - (b.km ?? 0),
      );
  }, [views, stopIds, vibes, hideVisited, anchor]);

  const setStops = (ids: string[]) => run((r) => r.setPlanPlaces(plan.id, ids));
  const move = (i: number, dir: -1 | 1) => {
    const ids = [...stopIds];
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    void setStops(ids);
  };

  const routeUrl = googleMapsRouteUrl(stops);
  const shareText = [
    `${plan.name} — ${formatDate(plan.date, true)}`,
    "",
    ...stops.map((s, i) => `${i + 1}. ${s.name}${s.area ? ` (${s.area})` : ""}\n   ${googleMapsPlaceUrl(s)}`),
    ...(routeUrl && stops.length > 1 ? ["", `Route: ${routeUrl}`] : []),
  ].join("\n");

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: plan.name, text: shareText }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(shareText);
      toast("Plan copied");
    }
  }

  const canDelete = plan.created_by === me?.id || isAdmin;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-3 pb-28 md:px-8 md:pt-6 md:pb-10">
        <div className="flex items-center justify-between">
          <IconButton label="Back to plans" onClick={onBack} className="-ml-2">
            <ArrowLeft size={20} />
          </IconButton>
          {canDelete &&
            (confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                Delete plan?
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await run((r) => r.deletePlan(plan.id), "Plan deleted");
                    onBack();
                  }}
                >
                  Delete
                </Button>
              </div>
            ) : (
              <IconButton label="Delete plan" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={18} />
              </IconButton>
            ))}
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== plan.name && run((r) => r.updatePlan(plan.id, { name: name.trim() }))}
          maxLength={80}
          aria-label="Plan name"
          className="mt-1 w-full bg-transparent text-2xl font-extrabold outline-none md:text-3xl"
        />
        <label className="mt-1 inline-flex items-center gap-2 text-sm text-muted">
          <CalendarDays size={16} />
          <input
            type="date"
            value={plan.date ?? ""}
            onChange={(e) => run((r) => r.updatePlan(plan.id, { date: e.target.value || null }))}
            className="rounded-lg border border-line bg-white px-2 py-1 font-semibold text-ink"
          />
        </label>

        <div className="mt-6">
          <SectionLabel>Stops</SectionLabel>
          {stops.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              No stops yet. Add some from the suggestions below.
            </div>
          ) : (
            <ol className="overflow-hidden rounded-2xl border border-line bg-white">
              {stops.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
                  <span className="w-5 text-center text-sm font-extrabold text-muted">{i + 1}</span>
                  <button type="button" onClick={() => select(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <CategoryIcon id={s.category} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{s.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {s.area}
                        {i > 0 && ` · ${formatKm(distanceKm(stops[i - 1], s))} from previous`}
                      </span>
                    </span>
                  </button>
                  <div className="flex">
                    <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-25">
                      <ChevronUp size={18} />
                    </IconButton>
                    <IconButton
                      label="Move down"
                      disabled={i === stops.length - 1}
                      onClick={() => move(i, 1)}
                      className="disabled:opacity-25"
                    >
                      <ChevronDown size={18} />
                    </IconButton>
                    <IconButton label="Remove stop" onClick={() => setStops(stopIds.filter((id) => id !== s.id))}>
                      <X size={18} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {stops.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("primary")}
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
              <Button variant="secondary" onClick={share}>
                <Share2 size={16} /> Share
              </Button>
              {routeUrl && (
                <a href={routeUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                  <Route size={16} /> Route
                </a>
              )}
              <Button
                variant="secondary"
                onClick={() =>
                  run(async (r) => {
                    for (const s of stops) if (s.mine?.status !== "visited") await r.setStatus(s.id, "visited");
                  }, "Marked as visited. Rate them!")
                }
              >
                <Check size={16} /> We went
              </Button>
            </div>
          )}
        </div>

        <div className="mt-8">
          <SectionLabel>What are you looking for?</SectionLabel>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                active={vibes.includes(c.id)}
                color={c.color}
                onClick={() => setVibes((v) => (v.includes(c.id) ? v.filter((x) => x !== c.id) : [...v, c.id]))}
              >
                <c.Icon size={15} style={vibes.includes(c.id) ? undefined : { color: c.color }} /> {c.short}
              </Chip>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hideVisited} onChange={(e) => setHideVisited(e.target.checked)} className="h-4 w-4 accent-ink" />
            Hide places I&apos;ve already visited
          </label>

          <div className="mt-4 mb-2 text-sm font-semibold text-muted">
            {suggestions.length} matching place{suggestions.length === 1 ? "" : "s"}
            {anchor && ` · distance from ${anchor.name}`}
          </div>
          <ul className="space-y-2">
            {suggestions.slice(0, 30).map(({ v, km }) => {
              const keen = v.savers.filter((s) => s.status !== "visited").length;
              return (
                <li key={v.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-3">
                  <button type="button" onClick={() => select(v.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <CategoryIcon id={v.category} />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{v.name}</span>
                      <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                        {v.avgRating != null && (
                          <span className="inline-flex items-center gap-1">
                            <Stars value={v.avgRating} size={11} />
                          </span>
                        )}
                        {keen > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users size={12} /> {keen} want{keen === 1 ? "s" : ""} to go
                          </span>
                        )}
                        {v.area && <span>· {v.area}</span>}
                        {km != null && <span>· {formatKm(km)}</span>}
                      </span>
                    </span>
                  </button>
                  <Button variant="secondary" className="px-3 py-2" onClick={() => setStops([...stopIds, v.id])}>
                    <Plus size={16} /> Add
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
