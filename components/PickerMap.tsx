"use client";

import L, { type Marker as LeafletMarker } from "leaflet";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLng } from "@/lib/geo";
import type { CategoryId } from "@/lib/types";
import { categoryIcon, TILE_ATTRIBUTION, TILE_URL } from "./MapView";

// Before a category is picked, show a plain pin rather than implying one.
const neutralIcon = L.divIcon({
  className: "wl-marker",
  html: `<div class="wl-pin is-selected" style="--c:#1f2328">${renderToStaticMarkup(<MapPin size={19} strokeWidth={2.3} />)}</div>`,
  iconSize: [38, 46],
  iconAnchor: [19, 46],
});

function Sync({ value, onPick }: { value: LatLng; onPick: (at: LatLng) => void }) {
  const map = useMap();
  const latest = useRef(value);
  latest.current = value;
  // The form opens with a slide-in animation; re-measure once the box has its final size.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      map.setView([latest.current.lat, latest.current.lng], map.getZoom(), { animate: false });
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  useEffect(() => {
    if (map.distance(map.getCenter(), [value.lat, value.lng]) > 5) {
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
    }
  }, [value.lat, value.lng, map]);
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Small map inside the Add/Edit form: tap anywhere or drag the pin to fine-tune. */
export default function PickerMap({
  value,
  category,
  onPick,
}: {
  value: LatLng;
  category: CategoryId | null;
  onPick: (at: LatLng) => void;
}) {
  return (
    <MapContainer center={[value.lat, value.lng]} zoom={15} zoomControl={false} className="h-full w-full">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <Marker
        position={[value.lat, value.lng]}
        icon={category ? categoryIcon(category, true) : neutralIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as LeafletMarker).getLatLng();
            onPick({ lat: ll.lat, lng: ll.lng });
          },
        }}
      />
      <Sync value={value} onPick={onPick} />
    </MapContainer>
  );
}
