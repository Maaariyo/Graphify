"use client";

import { Crosshair, Link2, LoaderCircle, LocateFixed, MapPin, Search, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, STATUSES } from "@/lib/categories";
import {
  DEFAULT_CENTER,
  distanceKm,
  getCurrentPosition,
  isGoogleMapsShortLink,
  isGoogleMapsUrl,
  parseCoordinates,
  parseGoogleMapsUrl,
  reverseGeocode,
  searchLocations,
  type GeocodeResult,
  type LatLng,
} from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { CategoryId, PlaceInput, Status } from "@/lib/types";
import { Sheet } from "./Sheet";
import { Button, cx, SectionLabel } from "./ui";

const PickerMap = dynamic(() => import("./PickerMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-paper" />,
});

interface Draft {
  name: string;
  at: LatLng | null;
  address: string | null;
  area: string;
  category: CategoryId | null;
  status: Status;
  note: string;
  source_url: string | null;
}

export function PlaceFormSheet() {
  const { editor, setEditor } = useStore();
  // Remount the form whenever the sheet is opened for a different target.
  const key = editor ? (editor.mode === "edit" ? editor.id : `add-${JSON.stringify(editor.initial ?? {})}`) : "closed";
  return (
    <Sheet open={!!editor} onClose={() => setEditor(null)} title={editor?.mode === "edit" ? "Edit place" : "Add a place"}>
      {editor && <PlaceForm key={key} />}
    </Sheet>
  );
}

function PlaceForm() {
  const { editor, setEditor, views, run, select, here, toast } = useStore();
  const editing = editor?.mode === "edit" ? views.find((v) => v.id === editor.id) : undefined;
  const initial = editor?.mode === "add" ? editor.initial : undefined;

  const [d, setD] = useState<Draft>(() =>
    editing
      ? {
          name: editing.name,
          at: { lat: editing.lat, lng: editing.lng },
          address: editing.address,
          area: editing.area ?? "",
          category: editing.category,
          status: editing.mine?.status ?? "want",
          note: editing.note ?? "",
          source_url: editing.source_url,
        }
      : {
          name: initial?.name ?? "",
          at: initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null,
          address: initial?.address ?? null,
          area: initial?.area ?? "",
          category: initial?.category ?? null,
          status: "want",
          note: "",
          source_url: null,
        },
  );
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState<null | "search" | "link" | "gps">(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const autoArea = useRef(true);

  // Fill the area from the map pin, unless the person typed their own.
  async function fillArea(at: LatLng) {
    try {
      const r = await reverseGeocode(at);
      if (r && autoArea.current) set({ area: r.area ?? "", address: r.label || null });
    } catch {
      /* area is optional */
    }
  }

  // Area for a pin dropped by long-press on the main map.
  useEffect(() => {
    if (!editing && d.at && !d.area) void fillArea(d.at);
  }, []);

  function pick(at: LatLng, name?: string | null, area?: string | null, label?: string | null) {
    setResults([]);
    setQuery("");
    setLocError(null);
    set({ at, ...(name && !d.name.trim() ? { name } : {}) });
    if (area) {
      autoArea.current = true;
      set({ area, address: label || null });
    } else {
      void fillArea(at);
    }
  }

  // Search box: coordinates, Google Maps links, or free text.
  useEffect(() => {
    const text = query.trim();
    setLocError(null);
    setBusy((b) => (b === "gps" ? b : null));
    if (!text) {
      setResults([]);
      return;
    }
    const coords = parseCoordinates(text);
    if (coords) {
      pick(coords);
      return;
    }
    const ctrl = new AbortController();
    const near = d.at ?? here ?? DEFAULT_CENTER;

    if (isGoogleMapsUrl(text)) {
      setBusy("link");
      (async () => {
        try {
          let parsed = parseGoogleMapsUrl(text);
          if (isGoogleMapsShortLink(text)) {
            const res = await fetch(`/api/resolve-link?url=${encodeURIComponent(text)}`, { signal: ctrl.signal });
            const json = (await res.json()) as { lat?: number; lng?: number; name?: string; error?: string };
            if (!res.ok) throw new Error(json.error || "Could not open that link");
            parsed = { coords: json.lat != null && json.lng != null ? { lat: json.lat, lng: json.lng } : null, name: json.name ?? null };
          }
          set({ source_url: text });
          if (parsed.coords) {
            pick(parsed.coords, parsed.name);
          } else if (parsed.name) {
            if (!d.name.trim()) set({ name: parsed.name });
            const found = await searchLocations(parsed.name, near, ctrl.signal);
            if (found.length) setResults(found);
            else setLocError("Link has no location in it. Search by name or drop a pin.");
          } else {
            setLocError("Couldn't read a location from that link. Search by name or drop a pin.");
          }
        } catch (e) {
          if (!ctrl.signal.aborted) setLocError(e instanceof Error ? e.message : "Couldn't read that link");
        } finally {
          setBusy((b) => (b === "link" ? null : b));
        }
      })();
      return () => ctrl.abort();
    }

    if (text.length < 3) return;
    const t = setTimeout(async () => {
      setBusy("search");
      try {
        setResults(await searchLocations(text, near, ctrl.signal));
      } catch {
        if (!ctrl.signal.aborted) setLocError("Search is unavailable right now. Drop a pin instead.");
      } finally {
        if (!ctrl.signal.aborted) setBusy(null);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  async function locateMe() {
    setBusy("gps");
    try {
      pick(await getCurrentPosition());
    } catch (e) {
      setLocError(e instanceof Error ? e.message : "Could not get your location");
    } finally {
      setBusy(null);
    }
  }

  // Someone in the group probably already added this.
  const duplicate = useMemo(() => {
    if (!d.at) return null;
    const name = d.name.trim().toLowerCase();
    return (
      views.find(
        (v) =>
          v.id !== editing?.id &&
          (distanceKm(v, d.at!) < 0.08 || (name.length > 3 && v.name.toLowerCase() === name && distanceKm(v, d.at!) < 3)),
      ) ?? null
    );
  }, [d.at, d.name, views, editing?.id]);

  const missing = !d.name.trim() ? "Add a name" : !d.at ? "Set a location" : !d.category ? "Pick a category" : null;

  async function save() {
    if (missing || !d.at || !d.category) return;
    setSaving(true);
    const input: PlaceInput = {
      name: d.name.trim(),
      lat: d.at.lat,
      lng: d.at.lng,
      address: d.address,
      area: d.area.trim() || null,
      category: d.category,
      note: d.note.trim() || null,
      source_url: d.source_url,
    };
    if (editing) {
      const ok = await run((r) => r.updatePlace(editing.id, input).then(() => true), "Saved");
      setSaving(false);
      if (ok) setEditor(null);
    } else {
      const place = await run((r) => r.addPlace(input, d.status), `${input.name} added`);
      setSaving(false);
      if (place) {
        setEditor(null);
        select(place.id);
      }
    }
  }

  return (
    <div className="space-y-6 px-5 pb-5">
      <div>
        <SectionLabel>Place name</SectionLabel>
        <input
          autoFocus={!editing && !d.at}
          value={d.name}
          onChange={(e) => set({ name: e.target.value })}
          maxLength={120}
          placeholder="e.g. Lodhi Garden"
          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-ink"
        />
      </div>

      <div>
        <SectionLabel>Location</SectionLabel>
        {d.at ? (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="h-44">
              <PickerMap value={d.at} category={d.category} onPick={(at) => pick(at)} />
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-white px-3 py-2">
              <MapPin size={16} className="shrink-0 text-muted" />
              <input
                value={d.area}
                onChange={(e) => {
                  autoArea.current = false;
                  set({ area: e.target.value });
                }}
                placeholder="Area, e.g. Hauz Khas"
                className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
              />
              <button type="button" className="text-sm font-semibold text-accent" onClick={() => set({ at: null })}>
                Change
              </button>
            </div>
            <div className="bg-paper px-3 py-1.5 text-xs text-muted">Tap the map or drag the pin to adjust.</div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 focus-within:border-ink">
              {busy === "link" ? <Link2 size={18} className="text-muted" /> : <Search size={18} className="text-muted" />}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search, or paste a Google Maps link"
                className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
                inputMode="search"
              />
              {(busy === "search" || busy === "link") && <LoaderCircle size={18} className="animate-spin text-muted" />}
            </div>
            {results.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-xl border border-line bg-white">
                {results.map((r, i) => (
                  <li key={`${r.lat},${r.lng},${i}`}>
                    <button
                      type="button"
                      onClick={() => pick({ lat: r.lat, lng: r.lng }, r.name, r.area, r.label)}
                      className="flex w-full items-start gap-3 border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-paper"
                    >
                      <MapPin size={16} className="mt-0.5 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{r.name}</span>
                        <span className="block truncate text-xs text-muted">{r.label}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {locError && <p className="mt-2 text-sm text-red-700">{locError}</p>}
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={locateMe} disabled={busy === "gps"}>
                {busy === "gps" ? <LoaderCircle size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                I&apos;m here
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => pick(here ?? DEFAULT_CENTER)}>
                <Crosshair size={16} /> Drop a pin
              </Button>
            </div>
          </div>
        )}
        {duplicate && (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <b>{duplicate.name}</b> is already on the map{duplicate.addedBy ? ` (added by ${duplicate.addedBy.name})` : ""}.
            </div>
            <button
              type="button"
              className="shrink-0 font-semibold underline"
              onClick={() => {
                setEditor(null);
                select(duplicate.id);
                if (!duplicate.mine) toast("Tap a status to save it to your list");
              }}
            >
              Open it
            </button>
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Category</SectionLabel>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((c) => {
            const active = d.category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => set({ category: c.id })}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-semibold transition-colors",
                  active ? "text-white" : "border-line bg-white text-ink hover:border-ink/30",
                )}
                style={active ? { background: c.color, borderColor: c.color } : undefined}
              >
                <c.Icon size={20} strokeWidth={2.2} style={active ? undefined : { color: c.color }} />
                {c.short}
              </button>
            );
          })}
        </div>
      </div>

      {!editing && (
        <div>
          <SectionLabel>Your status</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={d.status === s.id}
                onClick={() => set({ status: s.id })}
                className={cx(
                  "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm font-semibold",
                  d.status === s.id ? "border-ink bg-ink text-white" : "border-line bg-white",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>Note</SectionLabel>
        <textarea
          value={d.note}
          onChange={(e) => set({ note: e.target.value })}
          maxLength={1000}
          rows={3}
          placeholder="Why should we go? Best time, what to order…"
          className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-ink"
        />
      </div>

      <Button className="w-full py-3.5 text-base" disabled={!!missing || saving} onClick={save}>
        {saving ? <LoaderCircle size={18} className="animate-spin" /> : null}
        {missing ?? (editing ? "Save changes" : "Add place")}
      </Button>
    </div>
  );
}
