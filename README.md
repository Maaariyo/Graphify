# Wanderlist

A private shared map where a group of friends saves places to explore, organised by category, status and location.

- **Map**: every place as a category marker. Tap one for details, directions and who saved it.
- **Places**: the database view (cards on phone, a table on desktop) with search, filters, category counts and sort.
- **Plan**: pick a date and a vibe, add matching saved places, reorder them, share to WhatsApp or open the route in Google Maps.
- **Friends**: who added what, what each person has visited, and invites (admins only).

Built with Next.js, Tailwind, Supabase (database + login) and Leaflet with OpenStreetMap/CARTO tiles. There are no paid APIs, no map API key and no email service.

---

## 1. Try it in 2 minutes (demo mode)

You need [Node.js 20+](https://nodejs.org).

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick a person. With no database connected, the app runs in **demo mode**: sample Delhi places, and data saved only in your browser. Use this to click around before setting anything up.

## 2. Connect a real shared database (Supabase, free tier)

No email service is needed. People join through a one-time link you send them on WhatsApp, then sign in with email + password.

1. Create a project at [supabase.com](https://supabase.com). Choose the **Mumbai (ap-south-1)** region.
2. Go to **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**.
3. In **Authentication → Sign In / Providers**, keep **Email** enabled and turn **off** "Allow new users to sign up". Accounts are only ever created from invite links, so nobody can register on their own.
4. Go to **Project Settings → API** and copy three values: **Project URL**, the **anon public** key, and the **service_role** key (secret).
5. Copy `.env.example` to `.env.local` and paste all three in.
6. Make yourself the first admin. In the SQL editor, run this with your real email:
   ```sql
   select public.issue_invite_token('you@gmail.com', 'admin');
   ```
   It returns a long code. Run `npm run dev`, open `http://localhost:3000/join#<that code>`, and choose your name and password.

## 3. Put it online (Vercel, free)

1. Push this repo to GitHub, then import it at [vercel.com/new](https://vercel.com/new).
2. Add the three environment variables from `.env.local` in the Vercel project settings. The service-role key must **not** start with `NEXT_PUBLIC_`.
3. Open the Vercel URL and sign in.

## 4. Invite friends

In the app, go to **Friends → Admin · Invites**, type their email and press **Invite**. You get a link with a **WhatsApp** button. It works once and expires in 7 days. They open it, pick a name and password, and they're in.

- **On iPhone:** after joining, tap **Share → Add to Home Screen**, then sign in once inside the home-screen app with the same email and password.
- **Forgot password:** tap the 🔑 next to their email to send a reset link. The same link flow sets a new password.
- **Remove someone:** tap ✕. Their access stops immediately.

---

## How it's organised

```
app/                    Screens: map (page.tsx), places/, plan/, friends/
app/api/resolve-link/   Expands Google Maps short links (maps.app.goo.gl) into coordinates
app/api/join/           Redeems an invite link: creates the account or resets the password (server-only key)
app/join/               The page an invite link opens
components/             MapView, PlaceForm (add/edit), PlaceDetail, FilterSheet, AppShell
lib/repo/               Data layer: supabase.ts (real) and local.ts (demo), same interface
lib/filters.ts          Search / filter / sort logic
lib/dedupe.ts           "Is this already on the map?" matching (same link, same spot, similar name)
lib/categories.ts       The 8 categories: icon, colour, label. Edit here to change them
supabase/schema.sql     Tables, access rules (row-level security), realtime
docs/PRODUCT_SPEC.md    What was built, what changed from the original brief, and why
```

### Access rules (enforced by the database, not just the UI)

| | Any member | Person who added it | Admin |
|---|---|---|---|
| See all places, statuses, plans | ✓ | | |
| Add a place / create a plan | ✓ | | |
| Set own status and rating | ✓ | | |
| Edit or delete a place | | ✓ | ✓ |
| Add or remove stops in any plan | ✓ | | |
| Delete a plan | | ✓ (creator) | ✓ |
| Invite or remove people | | | ✓ |

Accounts exist only for invited emails (sign-ups are off). Someone removed from the invite list can still log in but sees nothing.

### Changing categories

Edit `lib/categories.ts`, then update the `category in (...)` check in `supabase/schema.sql` and run this in Supabase:

```sql
alter table public.places drop constraint places_category_check;
alter table public.places add constraint places_category_check
  check (category in ('eat','cafe','adventure','chill','trail','culture','activity','night'));
```
