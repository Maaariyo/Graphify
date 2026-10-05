export interface LatLng {
  lat: number;
  lng: number;
}

/** Default map centre: India Gate, New Delhi. Change to your city. */
export const DEFAULT_CENTER: LatLng = { lat: 28.6129, lng: 77.2295 };
export const DEFAULT_ZOOM = 11;

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function valid(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** "28.5931, 77.2197" typed or pasted directly. */
export function parseCoordinates(text: string): LatLng | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  return m ? valid(parseFloat(m[1]), parseFloat(m[2])) : null;
}

export function isGoogleMapsShortLink(text: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(text.trim());
}

export function isGoogleMapsUrl(text: string): boolean {
  return /^https?:\/\/([a-z]+\.)?google\.[a-z.]+\/maps/i.test(text.trim()) || isGoogleMapsShortLink(text);
}

/**
 * Pulls coordinates (and the place name when present) out of a full Google Maps URL.
 * `!3d..!4d..` is the pinned place itself, so it wins over `@lat,lng` (the viewport centre).
 */
export function parseGoogleMapsUrl(raw: string): { coords: LatLng | null; name: string | null } {
  let url = raw.trim();
  try {
    url = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  let coords: LatLng | null = null;
  const pin = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pin) coords = valid(parseFloat(pin[1]), parseFloat(pin[2]));
  if (!coords) {
    const q = url.match(/[?&](?:q|query|ll|center|destination)=(-?\d+\.\d+)\s*,\s*\+?(-?\d+\.\d+)/);
    if (q) coords = valid(parseFloat(q[1]), parseFloat(q[2]));
  }
  if (!coords) {
    const search = url.match(/\/search\/(-?\d+\.\d+)\s*,\s*\+?(-?\d+\.\d+)/);
    if (search) coords = valid(parseFloat(search[1]), parseFloat(search[2]));
  }
  if (!coords) {
    const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) coords = valid(parseFloat(at[1]), parseFloat(at[2]));
  }
  let name: string | null = null;
  const place = url.match(/\/place\/([^/@?]+)/);
  if (place) name = place[1].replace(/\+/g, " ").trim();
  if (!name) {
    const q = url.match(/[?&]q=([^&]+)/);
    if (q && !parseCoordinates(q[1].replace(/\+/g, " "))) name = q[1].replace(/\+/g, " ").trim();
  }
  return { coords, name: name || null };
}

export function googleMapsPlaceUrl(p: LatLng & { name?: string }): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

export function googleMapsDirectionsUrl(dest: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
}

/** Multi-stop route for a plan. Google allows up to 9 waypoints in a URL. */
export function googleMapsRouteUrl(stops: LatLng[]): string | null {
  if (stops.length === 0) return null;
  if (stops.length === 1) return googleMapsDirectionsUrl(stops[0]);
  const fmt = (s: LatLng) => `${s.lat},${s.lng}`;
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1).slice(0, 9).map(fmt).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${fmt(origin)}&destination=${fmt(destination)}`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

export interface GeocodeResult {
  name: string;
  label: string;
  area: string | null;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function photonToResult(f: PhotonFeature): GeocodeResult {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const area = p.district || p.locality || p.suburb || p.city || p.county || p.state || null;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const name = p.name || street || area || "Dropped pin";
  const label = [p.name ? street : null, p.district || p.locality, p.city, p.state]
    .filter((x, i, arr) => x && arr.indexOf(x) === i)
    .join(", ");
  return { name, label, area, lat, lng };
}

/**
 * Place search via Photon (OpenStreetMap data, free, no API key).
 * Results are biased towards `near` so "Blue Tokai" finds the Delhi one first.
 */
export async function searchLocations(query: string, near?: LatLng, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q: query, limit: "6", lang: "en" });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Location search failed (${res.status})`);
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features.map(photonToResult);
}

export async function reverseGeocode(at: LatLng, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${at.lat}&lon=${at.lng}&lang=en`, { signal });
  if (!res.ok) return null;
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features[0] ? photonToResult(json.features[0]) : null;
}

export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location is not available on this device"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? "Location permission denied" : "Could not get your location")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}
