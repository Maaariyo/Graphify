import { parseGoogleMapsUrl } from "@/lib/geo";

// Short links (maps.app.goo.gl/…) are redirects; the browser can't follow them cross-origin, so we do it here.
// Only Google hosts are followed, so this can't be used to fetch arbitrary URLs.
const ALLOWED_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+|consent\.google\.[a-z.]+)$/i;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return Response.json({ error: "Missing url" }, { status: 400 });

  let current: URL;
  try {
    current = new URL(raw);
  } catch {
    return Response.json({ error: "That isn't a valid link" }, { status: 400 });
  }

  for (let hop = 0; hop < 6; hop++) {
    if (current.protocol !== "https:" || !ALLOWED_HOSTS.test(current.hostname)) {
      return Response.json({ error: "Only Google Maps links are supported" }, { status: 400 });
    }
    // Google's cookie-consent interstitial carries the real destination in `continue`.
    const cont = current.hostname.startsWith("consent.") ? current.searchParams.get("continue") : null;
    if (cont) {
      current = new URL(cont);
      continue;
    }
    const parsed = parseGoogleMapsUrl(current.toString());
    if (parsed.coords) return Response.json({ ...parsed.coords, name: parsed.name });

    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        headers: { "user-agent": "Mozilla/5.0 (compatible; Wanderlist/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return Response.json({ error: "Google Maps didn't respond. Try again." }, { status: 502 });
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    // Final page: no coordinates in the URL, but the name may still be there.
    return Response.json({ name: parsed.name });
  }
  return Response.json({ error: "Too many redirects" }, { status: 502 });
}
