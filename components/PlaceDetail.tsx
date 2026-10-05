"use client";

import { CalendarPlus, Check, ExternalLink, Navigation, Pencil, Share2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { CATEGORY_BY_ID, STATUS_BY_ID, STATUSES } from "@/lib/categories";
import { formatKm, googleMapsDirectionsUrl, googleMapsPlaceUrl } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { PlaceView } from "@/lib/types";
import { Sheet } from "./Sheet";
import { Avatar, Button, buttonClass, CategoryIcon, cx, IconButton, SectionLabel, Stars, StatusDot, timeAgo } from "./ui";

export function PlaceDetailSheet() {
  const { selectedId, select, views, editor } = useStore();
  const place = selectedId ? views.find((v) => v.id === selectedId) : undefined;
  return (
    <Sheet open={!!place && !editor} onClose={() => select(null)} variant="panel">
      {place && <PlaceDetail key={place.id} place={place} />}
    </Sheet>
  );
}

async function sharePlace(p: PlaceView, toast: (t: string) => void) {
  const url = googleMapsPlaceUrl(p);
  const text = `${p.name}${p.area ? ` (${p.area})` : ""}${p.note ? ` — ${p.note}` : ""}`;
  if (navigator.share) {
    await navigator.share({ title: p.name, text, url }).catch(() => undefined); // rejects when the user cancels
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  toast("Opening WhatsApp");
}

function PlaceDetail({ place: p }: { place: PlaceView }) {
  const { select, setEditor, run, canEdit, data, me, toast } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [planPicker, setPlanPicker] = useState(false);
  const cat = CATEGORY_BY_ID[p.category];
  const memberName = (id: string) => data?.members.find((m) => m.id === id);
  const others = p.savers.filter((s) => s.user_id !== me?.id);
  const ratings = p.savers.filter((s) => s.rating != null).length;
  const today = new Date().toISOString().slice(0, 10);
  const plans = (data?.plans ?? []).filter((pl) => !pl.date || pl.date >= today);
  const inPlans = new Set((data?.planPlaces ?? []).filter((pp) => pp.place_id === p.id).map((pp) => pp.plan_id));

  async function addToPlan(planId: string) {
    const current = (data?.planPlaces ?? [])
      .filter((pp) => pp.plan_id === planId)
      .sort((a, b) => a.position - b.position)
      .map((pp) => pp.place_id);
    if (current.includes(p.id)) return;
    await run((r) => r.setPlanPlaces(planId, [...current, p.id]), "Added to plan");
    setPlanPicker(false);
  }

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-3 pt-2 md:pt-3">
        <IconButton label="Close" onClick={() => select(null)}>
          <X size={20} />
        </IconButton>
        <div className="flex gap-1">
          <IconButton label="Share" onClick={() => sharePlace(p, toast)}>
            <Share2 size={18} />
          </IconButton>
          {canEdit(p) && (
            <IconButton label="Edit" onClick={() => setEditor({ mode: "edit", id: p.id })}>
              <Pencil size={18} />
            </IconButton>
          )}
        </div>
      </div>

      <div className="px-5">
        <div className="flex items-start gap-3.5">
          <CategoryIcon id={p.category} size="lg" />
          <div className="min-w-0 pt-0.5">
            <h2 className="text-xl leading-tight font-extrabold">{p.name}</h2>
            <div className="mt-1 text-sm text-muted">
              {cat.label}
              {p.area && ` · ${p.area}`}
              {p.distanceKm != null && ` · ${formatKm(p.distanceKm)} away`}
            </div>
            {p.avgRating != null && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm">
                <Stars value={p.avgRating} size={14} />
                <span className="font-semibold">{p.avgRating.toFixed(1)}</span>
                <span className="text-muted">
                  · {ratings} rating{ratings > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <SectionLabel>Your status</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map((s) => {
              const active = p.mine?.status === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => run((r) => r.setStatus(p.id, s.id))}
                  className={cx(
                    "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors",
                    active ? "text-white" : "border-line bg-white hover:border-ink/30",
                  )}
                  style={active ? { background: s.color, borderColor: s.color } : undefined}
                >
                  {active ? <Check size={15} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />}
                  {s.label}
                </button>
              );
            })}
          </div>
          {p.mine?.status === "visited" && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-paper px-3.5 py-2.5">
              <span className="text-sm font-semibold">Your rating</span>
              <Stars value={p.mine.rating} onChange={(v) => run((r) => r.setStatus(p.id, "visited", v))} size={22} />
            </div>
          )}
          {p.mine && (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-muted underline"
              onClick={() => run((r) => r.setStatus(p.id, null), "Removed from your list")}
            >
              Remove from my list
            </button>
          )}
        </div>

        {p.note && (
          <blockquote className="mt-5 rounded-xl border-l-4 bg-paper px-4 py-3 text-[15px]" style={{ borderColor: cat.color }}>
            “{p.note}”
          </blockquote>
        )}

        <div className="mt-5 flex items-center gap-2.5 text-sm">
          <Avatar member={p.addedBy} size={26} />
          <span>
            Added by <b>{p.addedBy?.id === me?.id ? "you" : (p.addedBy?.name ?? "a former member")}</b>
            <span className="text-muted"> · {timeAgo(p.created_at)}</span>
          </span>
        </div>

        {others.length > 0 && (
          <div className="mt-5">
            <SectionLabel>
              {others.length} friend{others.length > 1 ? "s" : ""} saved this
            </SectionLabel>
            <ul className="space-y-2">
              {others.map((s) => {
                const m = memberName(s.user_id);
                return (
                  <li key={s.user_id} className="flex items-center gap-2.5 text-sm">
                    <Avatar member={m ?? null} size={26} />
                    <span className="font-semibold">{m?.name ?? "Former member"}</span>
                    <StatusDot status={s.status} />
                    <span className="text-muted">{STATUS_BY_ID[s.status].label}</span>
                    {s.rating != null && <Stars value={s.rating} size={12} />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <a href={googleMapsDirectionsUrl(p)} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
            <Navigation size={16} /> Directions
          </a>
          <a
            href={p.source_url || googleMapsPlaceUrl(p)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary")}
          >
            <ExternalLink size={16} /> Open Maps
          </a>
          <Button variant="secondary" className="col-span-2" onClick={() => setPlanPicker((v) => !v)}>
            <CalendarPlus size={16} /> Add to a plan
          </Button>
        </div>

        {planPicker && (
          <div className="mt-2 overflow-hidden rounded-xl border border-line">
            {plans.length === 0 && <div className="px-3.5 py-3 text-sm text-muted">No upcoming plans. Create one in Plan.</div>}
            {plans.map((pl) => (
              <button
                key={pl.id}
                type="button"
                disabled={inPlans.has(pl.id)}
                onClick={() => addToPlan(pl.id)}
                className="flex w-full items-center justify-between border-b border-line px-3.5 py-2.5 text-left text-sm last:border-0 hover:bg-paper disabled:text-muted"
              >
                <span className="font-semibold">{pl.name}</span>
                <span className="text-xs text-muted">
                  {inPlans.has(pl.id)
                    ? "Already in"
                    : pl.date
                      ? new Date(pl.date + "T00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
                      : "No date"}
                </span>
              </button>
            ))}
          </div>
        )}

        {canEdit(p) && (
          <div className="mt-6 border-t border-line pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm">Delete for everyone?</span>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    await run((r) => r.deletePlace(p.id), "Place deleted");
                    select(null);
                  }}
                >
                  Delete
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} /> Delete place
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
