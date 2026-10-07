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

/** fetch() that gives up after `ms`, while still honouring the caller's own abort. */
async function fetchJson<T>(url: string, signal: AbortSignal | undefined, ms = 4000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

interface NominatimPlace {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string | undefined>;
}

function nominatimToResult(p: NominatimPlace): GeocodeResult {
  const a = p.address ?? {};
  const area = a.suburb || a.neighbourhood || a.city_district || a.city || a.town || a.county || a.state || null;
  return {
    name: p.name || p.display_name.split(",")[0],
    label: p.display_name.split(",").slice(1, 4).join(",").trim(),
    area,
    lat: parseFloat(p.lat),
    lng: parseFloat(p.lon),
  };
}

/**
 * Place search. Photon (OpenStreetMap data, free, no key) is the main source and is built for type-ahead.
 * If it is down, slow or finds nothing, Nominatim (OpenStreetMap's own geocoder) is tried instead.
 * Results are biased towards `near` so "Blue Tokai" finds the Delhi one first.
 */
export async function searchLocations(query: string, near?: LatLng, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const photon = new URLSearchParams({ q: query, limit: "6", lang: "en" });
  if (near) {
    photon.set("lat", String(near.lat));
    photon.set("lon", String(near.lng));
  }
  try {
    const json = await fetchJson<{ features: PhotonFeature[] }>(`https://photon.komoot.io/api/?${photon}`, signal);
    if (json.features.length) return json.features.map(photonToResult);
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  const nominatim = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "6", "accept-language": "en" });
  if (near) {
    // Prefer results within ~50 km without excluding the rest.
    nominatim.set("viewbox", [near.lng - 0.5, near.lat + 0.5, near.lng + 0.5, near.lat - 0.5].join(","));
  }
  const places = await fetchJson<NominatimPlace[]>(`https://nominatim.openstreetmap.org/search?${nominatim}`, signal, 6000);
  return places.map(nominatimToResult);
}

export async function reverseGeocode(at: LatLng, signal?: AbortSignal): Promise<GeocodeResult | null> {
  try {
    const json = await fetchJson<{ features: PhotonFeature[] }>(
      `https://photon.komoot.io/reverse?lat=${at.lat}&lon=${at.lng}&lang=en`,
      signal,
    );
    if (json.features[0]) return photonToResult(json.features[0]);
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  try {
    const p = await fetchJson<NominatimPlace>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=en&lat=${at.lat}&lon=${at.lng}`,
      signal,
      6000,
    );
    return p?.display_name ? nominatimToResult(p) : null;
  } catch {
    return null;
  }
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
