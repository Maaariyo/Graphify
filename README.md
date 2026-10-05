# Wanderlist

A private shared map where a group of friends saves places to explore, organised by category, status and location.

- **Map**: every place as a category marker. Tap one for details, directions and who saved it.
- **Places**: the database view (cards on phone, a table on desktop) with search, filters, category counts and sort.
- **Plan**: pick a date and a vibe, add matching saved places, reorder them, share to WhatsApp or open the route in Google Maps.
- **Friends**: who added what, what each person has visited, and invites (admins only).

Built with Next.js, Tailwind, Supabase (database + login) and Leaflet with OpenStreetMap/CARTO tiles. There are no paid APIs and no map API key.

---

## 1. Try it in 2 minutes (demo mode)

You need [Node.js 20+](https://nodejs.org).

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick a person. With no database connected, the app runs in **demo mode**: sample Delhi places, and data saved only in your browser. Use this to click around before setting anything up.

## 2. Connect a real shared database (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com). Choose the **Mumbai (ap-south-1)** region.
2. Go to **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**.
3. In the same editor, add yourself as the first admin (use your real email):
   ```sql
   insert into public.invites (email, role) values ('you@gmail.com', 'admin');
   ```
4. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
5. Copy `.env.example` to `.env.local` and paste both values in.
6. Run `npm run dev` again. You'll now see the email sign-in screen instead of demo mode.

### Login email: do not skip this

- **Supabase's built-in email only delivers to members of your Supabase team.** Your friends won't get a sign-in email until you add your own email sender. The simplest is [Resend](https://resend.com) (free tier). Create an API key there, then in Supabase go to **Authentication → Emails → SMTP Settings**, enable custom SMTP, and enter host `smtp.resend.com`, port `465`, user `resend`, and your API key as the password.
- **Show the 6-digit code in the email.** In **Authentication → Emails → Templates**, add `Your code: {{ .Token }}` to the body of both **Magic Link** and **Confirm signup** (a friend's first sign-in uses the second one). On iPhone, a link in an email opens in Safari, not in the installed home-screen app, so friends need to type the code instead.
- **Optional: Google sign-in** (one tap, no email). Enable Google under **Authentication → Providers** (this needs a Google Cloud OAuth client). Then set `NEXT_PUBLIC_GOOGLE_AUTH=true`.

## 3. Put it online (Vercel, free)

1. Push this repo to GitHub, then import it at [vercel.com/new](https://vercel.com/new).
2. Add the same environment variables from `.env.local` in the Vercel project settings.
3. After the first deploy, go to Supabase **Authentication → URL Configuration**. Set **Site URL** to your Vercel URL, and add it plus `http://localhost:3000` to **Redirect URLs**.
4. Send friends the link. On a phone, use **Share → Add to Home Screen** and it opens like an app.

## 4. Invite friends

Open **Friends** in the app (as an admin), type their email and press **Invite**. They sign in with that exact email. Removing an invite cuts off their access immediately.

---

## How it's organised

```
app/                    Screens: map (page.tsx), places/, plan/, friends/
app/api/resolve-link/   Expands Google Maps short links (maps.app.goo.gl) into coordinates
components/             MapView, PlaceForm (add/edit), PlaceDetail, FilterSheet, AppShell
lib/repo/               Data layer: supabase.ts (real) and local.ts (demo), same interface
lib/filters.ts          Search / filter / sort logic
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

Anyone not on the invite list can sign in but sees nothing.

### Changing categories

Edit `lib/categories.ts`, then update the `category in (...)` check in `supabase/schema.sql` and run this in Supabase:

```sql
alter table public.places drop constraint places_category_check;
alter table public.places add constraint places_category_check
  check (category in ('eat','cafe','adventure','chill','trail','culture','activity','night'));
```
