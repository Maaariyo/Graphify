# Wanderlist: V1 spec and decisions

This file records what was built from the original brief, where the build deliberately differs, and what comes next.

## Scope delivered

| Brief phase | Status | Notes |
|---|---|---|
| 1. Foundation (Next.js, Tailwind, Supabase, auth, nav) | Done | Invite-only email-code login; optional Google |
| 2. Map (markers, search, add place) | Done | Custom category markers; search, Google Maps link paste, current location, drop pin |
| 3. Database (categories, status, attribution, edit/delete) | Done | Status is **per person** (see D1) |
| 4. Dashboard (list/table, search, filters, sort) | Done | Combined filters: category × my status × added by × distance × popular |
| 5. Polish (mobile, PWA, empty/loading/error states) | Mostly | Installable PWA; no offline mode |
| 6. Plans | Done | Earlier than the brief suggested; it's cheap once places exist |
| Photos | Not built | See roadmap |

## Decisions that differ from the brief

**D1. Status and rating are per person, not per place.** The brief's schema has one `status` and one `rating` on `places`. That breaks for a group: if Aditi marks Lodhi Garden "Visited", it becomes visited for Kuber too, and nobody can tell who rated what. It also makes the brief's best social signal, "3 friends saved this", impossible to compute. V1 uses a `place_status` table with one row per (person, place). A row existing means that person saved the place. The place's rating is the group average.

**D2. Leaflet + OpenStreetMap/CARTO instead of Mapbox.** For about 10 users Mapbox's free tier would cost nothing either, but it needs an account, a billing card and an API key in the client. Leaflet needs none of that, and the map looks the same. Place search uses Photon (OpenStreetMap data, free, no key). The trade-off: OSM is weaker than Google on small Indian restaurants and cafes, which is why D3 exists.

**D3. Pasting a Google Maps link is a first-class way to add a place.** In practice your group already shares places as Google Maps links on WhatsApp. Pasting one (including `maps.app.goo.gl` short links) fills in the name and the exact pin. This covers OSM's gaps without paying for the Google Places API.

**D4. No Google ratings or photos.** The "⭐ 4.5" in the brief's mock-up would need the Google Places API, which is paid and has terms that restrict storing results. V1 ratings are the group's own 1–5 stars, which matter more for a friends' list anyway.

**D5. Categories live in code, not a `categories` table.** Eight rows that change once a year don't need an admin UI. Editing `lib/categories.ts` is a one-minute change. "Admins manage categories" was dropped.

**D6. Duplicate guard.** Ten people saving the same Delhi spots will create duplicates. When a new place is within 80 m of an existing one, or has the same name within 3 km, the form warns and offers to open the existing place.

**D7. Email code instead of a magic link.** On iPhone, an emailed link opens in Safari, not in the installed home-screen app, so the user ends up signed in in the wrong place. The 6-digit code works everywhere. Supabase's default email also only reaches your own team, so custom SMTP is required (see README).

**D8. Four tabs instead of three.** Friends is a tab, not a hidden avatar menu. The avatar still links there from the phone map.

**D9. Dense areas.** Below zoom 13, markers shrink to small category dots so South Delhi doesn't turn into a pile of overlapping pins. A pin's number badge shows how many friends saved it.

## Data model (as built)

```
invites       email PK, role (member|admin)             ← the access list
profiles      id → auth.users, email, name
places        id, name, lat, lng, address, area, category, note, source_url, created_by, timestamps
place_status  (place_id, user_id) PK, status (want|planning|visited), rating 1–5
plans         id, name, date, created_by
plan_places   (plan_id, place_id) PK, position
```

Row-level security enforces every rule in the README's access table. It was tested against Postgres 16 with a mocked Supabase auth layer: spoofed creator, writing someone else's status, a member inviting, an uninvited user reading, and a removed member reading were all rejected.

## Known gaps and risks

- **Supabase mode hasn't been run against a live Supabase project.** It was tested with the schema on local Postgres and with the login screen. Do one full sign-in → add place → second-user check after setup.
- **Free Supabase projects pause after 7 days with no activity.** A paused project has to be restored with one click in the Supabase dashboard, and the app shows a load error until then. A group that uses it weekly won't hit this.
- **CARTO tiles and Photon search are free community services.** Fine at this scale, but there's no SLA.
- **No offline support.** The PWA installs, but it needs a connection to load data.

## Roadmap (in priority order)

1. **Photos**: Supabase Storage bucket plus a `photos` table (already in the brief's schema). Compress images on the client before upload.
2. **WhatsApp-native adding**: a share target, so a Google Maps link shared from the Maps app goes straight into "Add place" (PWA `share_target`, Android only; iOS doesn't support it).
3. **Plan voting**: each friend gives 👍/👎 on proposed stops, so the plan resolves itself instead of being decided in the group chat.
4. **"Near me now" on the Map**: one tap for "places on my list within 3 km, open now". Needs opening hours, so it depends on D4 being revisited.
5. **Activity feed**: "Rahul added 3 places this week". This drives return visits more than any other feature here.
