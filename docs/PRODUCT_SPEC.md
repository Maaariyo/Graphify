# Wanderlist: V1 spec and decisions

This file records what was built from the original brief, where the build deliberately differs, and what comes next.

## Scope delivered

| Brief phase | Status | Notes |
|---|---|---|
| 1. Foundation (Next.js, Tailwind, Supabase, auth, nav) | Done | Invite links over WhatsApp + password; no email service |
| 2. Map (markers, search, add place) | Done | Custom category markers; search, Google Maps link paste, current location, drop pin |
| 3. Database (categories, status, attribution, edit/delete) | Done | Status is **per person** (see D1) |
| 4. Dashboard (list/table, search, filters, sort) | Done | Combined filters: category × my status × added by × distance × popular |
| 5. Polish (mobile, PWA, empty/loading/error states) | Mostly | Installable PWA; no offline mode |
| 6. Plans | Done | Earlier than the brief suggested; it's cheap once places exist |
| Photos | Not built | See roadmap |

## Decisions that differ from the brief

**D1. Status and rating are per person, not per place.** The brief's schema has one `status` and one `rating` on `places`. That breaks for a group: if Aditi marks Lodhi Garden "Visited", it becomes visited for Kuber too, and nobody can tell who rated what. It also makes the brief's best social signal, "3 friends saved this", impossible to compute. V1 uses a `place_status` table with one row per (person, place). A row existing means that person saved the place. The place's rating is the group average.

**D2. Leaflet + OpenStreetMap/CARTO instead of Mapbox.** For about 10 users Mapbox's free tier would cost nothing either, but it needs an account, a billing card and an API key in the client. Leaflet needs none of that, and the map looks the same. Free services have no SLA, so each has a backup that kicks in automatically:
- **Map tiles:** CARTO first. After repeated failed tiles, the map switches to OpenStreetMap's own tile server for the rest of the session.
- **Place search and area lookup:** Photon first, with a 4-second timeout. If it errors, is slow or finds nothing, Nominatim (OpenStreetMap's official geocoder) answers instead.

The remaining trade-off: OSM data is weaker than Google on small Indian restaurants and cafes, which is why D3 exists.

**D3. Pasting a Google Maps link is a first-class way to add a place.** In practice your group already shares places as Google Maps links on WhatsApp. Pasting one (including `maps.app.goo.gl` short links) fills in the name and the exact pin. This covers OSM's gaps without paying for the Google Places API.

**D4. No Google ratings or photos.** The "⭐ 4.5" in the brief's mock-up would need the Google Places API, which is paid and has terms that restrict storing results. V1 ratings are the group's own 1–5 stars, which matter more for a friends' list anyway.

**D5. Categories live in code, not a `categories` table.** Eight rows that change once a year don't need an admin UI. Editing `lib/categories.ts` is a one-minute change. "Admins manage categories" was dropped.

**D6. Duplicate guard.** Ten people saving the same Delhi spots will create duplicates, and duplicates split the "N friends saved this" count. Matching (`lib/dedupe.ts`) flags an existing place when any of these hold:
- the same Google Maps link
- the same spot (within 30 m)
- a similar name within 2 km: filler words ("cafe", "the") and plurals are ignored, and one name may contain the other ("Blue Tokai" ↔ "Blue Tokai, Champa Gali")
- an identical name anywhere, which works even before a location is set

When there's a match, the form's main action becomes **Save this**, which adds the existing place to your list with your chosen status. Creating a new place requires an explicit "It's a different place. Add it anyway". The same Blue Tokai name 20 km away is correctly *not* flagged.

**D7. Invite links + password instead of email login.** Two problems with email login:
- Supabase's built-in email only delivers to your own Supabase team, so friends would never receive a sign-in email without a paid or extra email service.
- On iPhone, an emailed link opens in Safari, not in the installed home-screen app, so people end up signed in in the wrong place.

So no email is sent at all. An admin taps **Invite**, gets a one-time link (7-day expiry, only a SHA-256 hash is stored) and sends it on WhatsApp. The friend picks a name and password, and the server route `/api/join` creates the account with the service-role key. Public sign-up is switched off in Supabase, so invited people are the only accounts that can exist. Password login works the same in Safari and in the home-screen app. A forgotten password uses the same flow: the admin taps 🔑 for a reset link.

Google sign-in was removed. With sign-ups off it can't create accounts, and it needed a Google Cloud setup for little gain.

**D8. Four tabs instead of three.** Friends is a tab, not a hidden avatar menu. The avatar still links there from the phone map.

**D9. Dense areas.** Below zoom 13, markers shrink to small category dots so South Delhi doesn't turn into a pile of overlapping pins. A pin's number badge shows how many friends saved it.

## Data model (as built)

```
invites       email PK, role (member|admin)             ← the access list
invite_tokens email PK → invites, token_hash, expires_at ← one-time join links (unreadable from the app)
profiles      id → auth.users, email, name
places        id, name, lat, lng, address, area, category, note, source_url, created_by, timestamps
place_status  (place_id, user_id) PK, status (want|planning|visited), rating 1–5
plans         id, name, date, created_by
plan_places   (plan_id, place_id) PK, position
```

Row-level security enforces every rule in the README's access table. It was tested against Postgres 16 with a mocked Supabase auth layer. These were all rejected: a spoofed creator, writing someone else's status, a member inviting, a member calling the internal token function, a member reading or writing tokens, an uninvited user reading, and a removed member reading.

## Known gaps and risks

- **Supabase mode hasn't been run against a live Supabase project.** It was tested at two levels:
  - the schema and access rules on local Postgres 16
  - the full app in a browser against a stand-in for Supabase's APIs, covering admin invite → WhatsApp link → join → password sign-in, a reused link (rejected), a wrong password, a password reset, and data loading

  After setup, do one real end-to-end check with a second person.
- **The service-role key is powerful.** It lives only in the server environment (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`), and the only code that uses it is `/api/join`.
- **Free Supabase projects pause after 7 days with no activity.** A paused project has to be restored with one click in the Supabase dashboard, and the app shows a load error until then. A group that uses it weekly won't hit this.
- **All map services are free community services with no SLA.** Each now has an automatic backup (D2). If both a primary and its backup are down, adding a place still works by pasting a Google Maps link or dropping a pin.
- **No offline support.** The PWA installs, but it needs a connection to load data.

## Roadmap (in priority order)

1. **Photos**: Supabase Storage bucket plus a `photos` table (already in the brief's schema). Compress images on the client before upload.
2. **WhatsApp-native adding**: a share target, so a Google Maps link shared from the Maps app goes straight into "Add place" (PWA `share_target`, Android only; iOS doesn't support it).
3. **Plan voting**: each friend gives 👍/👎 on proposed stops, so the plan resolves itself instead of being decided in the group chat.
4. **"Near me now" on the Map**: one tap for "places on my list within 3 km, open now". Needs opening hours, so it depends on D4 being revisited.
5. **Activity feed**: "Rahul added 3 places this week". This drives return visits more than any other feature here.
