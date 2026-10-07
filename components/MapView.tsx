"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { DEFAULT_CENTER, DEFAULT_ZOOM, type LatLng } from "@/lib/geo";
import type { CategoryId, PlaceView } from "@/lib/types";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Free tile servers, best-looking first. If one fails, the map switches to the next for the rest of the session. */
const TILE_PROVIDERS = [
  {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
  },
  { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: OSM_ATTRIBUTION },
];
let providerIndex = 0;

export function BaseTiles() {
  const [index, setIndex] = useState(providerIndex);
  const stats = useRef({ ok: 0, failed: 0 });
  const provider = TILE_PROVIDERS[index];
  return (
    <TileLayer
      key={index}
      url={provider.url}
      attribution={provider.attribution}
      maxZoom={19}
      eventHandlers={{
        tileload: () => void stats.current.ok++,
        tileerror: () => {
          stats.current.failed++;
          const { ok, failed } = stats.current;
          if (failed >= 3 && failed > ok && index < TILE_PROVIDERS.length - 1) {
            providerIndex = index + 1;
            stats.current = { ok: 0, failed: 0 };
            setIndex(providerIndex);
          }
        },
      }}
    />
  );
}

const iconCache = new Map<string, L.DivIcon>();

/** Below this zoom, pins shrink to dots so a dense neighbourhood stays readable. */
const COMPACT_BELOW_ZOOM = 13;

export function categoryIcon(category: CategoryId, selected = false, badge?: number, compact = false): L.DivIcon {
  const key = `${category}|${selected}|${badge ?? ""}|${compact}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const c = CATEGORY_BY_ID[category];
  if (compact) {
    const icon = L.divIcon({
      className: "wl-marker",
      html: `<div class="wl-dot" style="--c:${c.color}">${renderToStaticMarkup(<c.Icon size={13} strokeWidth={2.6} />)}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    iconCache.set(key, icon);
    return icon;
  }
  const svg = renderToStaticMarkup(<c.Icon size={19} strokeWidth={2.3} />);
  const badgeHtml = badge ? `<span class="wl-badge" style="background:#1f2328">${badge}</span>` : "";
  const icon = L.divIcon({
    className: "wl-marker",
    html: `<div class="wl-pin${selected ? " is-selected" : ""}" style="--c:${c.color}">${svg}${badgeHtml}</div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 46],
  });
  iconCache.set(key, icon);
  return icon;
}

const hereIcon = L.divIcon({ className: "wl-marker", html: '<div class="wl-here"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function Controller({
  places,
  selectedId,
  here,
  onBackgroundTap,
  onLongPress,
  onMove,
  onZoom,
}: {
  places: PlaceView[];
  selectedId: string | null;
  here: LatLng | null;
  onZoom: (zoom: number) => void;
  onBackgroundTap: () => void;
  onLongPress?: (at: LatLng) => void;
  onMove?: (center: LatLng) => void;
}) {
  const map = useMap();
  const fitted = useRef(false);

  // Leaflet needs to be told when its container changes size (sidebar, sheet, rotation).
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  // Fit all places once, on first data.
  useEffect(() => {
    if (fitted.current || places.length === 0) return;
    fitted.current = true;
    if (places.length === 1) map.setView([places[0].lat, places[0].lng], 14);
    else
      map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), {
        // Leave room for the search bar + chips overlaid on top of the map.
        paddingTopLeft: [40, 170],
        paddingBottomRight: [40, 60],
        maxZoom: 14,
      });
  }, [map, places]);

  // Bring the selected place into view, above the bottom sheet on phones.
  useEffect(() => {
    if (!selectedId) return;
    const p = places.find((x) => x.id === selectedId);
    if (!p) return;
    const zoom = Math.max(map.getZoom(), 13);
    const isPhone = map.getContainer().clientWidth < 768;
    const target = map.project([p.lat, p.lng], zoom);
    // Phone: keep the pin between the search bar and the bottom sheet.
    if (isPhone) target.y += map.getContainer().clientHeight * 0.12;
    else target.x += map.getContainer().clientWidth * 0.17;
    map.flyTo(map.unproject(target, zoom), zoom, { duration: 0.5 });
    // Only when selection changes, not on every data refresh.
  }, [selectedId, map]);

  useEffect(() => {
    if (here) map.flyTo([here.lat, here.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [here, map]);

  useMapEvents({
    click: () => onBackgroundTap(),
    contextmenu: (e) => onLongPress?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    zoomend: () => onZoom(map.getZoom()),
    moveend: () => {
      const c = map.getCenter();
      onMove?.({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

export default function MapView({
  places,
  selectedId,
  here,
  onSelect,
  onLongPress,
  onMove,
}: {
  places: PlaceView[];
  selectedId: string | null;
  here: LatLng | null;
  onSelect: (id: string | null) => void;
  onLongPress?: (at: LatLng) => void;
  onMove?: (center: LatLng) => void;
}) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const compact = zoom < COMPACT_BELOW_ZOOM;
  const markers = useMemo(
    () =>
      places.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={categoryIcon(
            p.category,
            p.id === selectedId,
            p.savers.length >= 2 ? p.savers.length : undefined,
            compact && p.id !== selectedId,
          )}
          zIndexOffset={p.id === selectedId ? 1000 : 0}
          title={p.name}
          alt={p.name}
          eventHandlers={{ click: () => onSelect(p.id) }}
        />
      )),
    [places, selectedId, onSelect, compact],
  );

  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      className="h-full w-full"
      attributionControl
    >
      <BaseTiles />
      {markers}
      {here && <Marker position={[here.lat, here.lng]} icon={hereIcon} interactive={false} />}
      <Controller
        places={places}
        selectedId={selectedId}
        here={here}
        onBackgroundTap={() => onSelect(null)}
        onLongPress={onLongPress}
        onMove={onMove}
        onZoom={setZoom}
      />
    </MapContainer>
  );
}
