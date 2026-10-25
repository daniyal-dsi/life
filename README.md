# Life Organiser

A personal installable web app (PWA) for Daniyal and Natascha: Home, Calendar,
Health, Work, Faith and More, with light and dark themes. Each person signs in
with their own email and keeps their own data; the household shares Meal Prep,
Masjid Mubarak times and the dua library.

The plan, design tokens and build order are in [docs/BRIEF.md](docs/BRIEF.md).
The approved look is [docs/prototype.html](docs/prototype.html) (reference only).

## Run it locally

You need Node 20 or later.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without Supabase settings the app runs in **demo
mode**: a "Not connected" banner shows and data stays in this browser.

To connect to Supabase locally, copy `.env.example` to `.env.local` and fill in
the two values. `.env.local` is git-ignored; never commit real values.

```bash
npm run build     # type-check and build to dist/
npm run preview   # serve the build
```

## Set up Supabase (once)

1. Create a free project at [supabase.com](https://supabase.com).
2. **Run the migration.** In the dashboard open **SQL Editor > New query**,
   paste the whole of [`supabase/migrations/0001_foundations.sql`](supabase/migrations/0001_foundations.sql)
   and click **Run**. (With the Supabase CLI you can instead run
   `supabase link` then `supabase db push`.)
3. **Sign-in emails.** Under **Authentication > URL Configuration** set the
   **Site URL** to your Vercel address (e.g. `https://life-organiser.vercel.app`)
   and add `http://localhost:5173` to **Redirect URLs**.
4. **Code in the email (recommended for iPhone).** A home-screen app can't
   receive the magic link (links open in Safari), so the sign-in screen also
   accepts the 6-digit code. Under **Authentication > Email Templates > Magic
   Link**, make sure the template includes `{{ .Token }}`, for example:
   `<p>Or enter this code: <b>{{ .Token }}</b></p>`.
5. Copy the **Project URL** and the **anon public** key from
   **Project Settings > API** for the next step.

## Deploy to Vercel

1. Import this GitHub repo in Vercel (framework preset: Vite).
2. Under **Project Settings > Environment Variables** add, for Production,
   Preview and Development:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |

3. Redeploy. `vercel.json` already sends every route to the app.

Supabase values go **only** into Vercel environment variables (and your own
`.env.local`), never into the repo or a chat.

## First use

1. Daniyal opens the app, signs in, and taps **Start one** to create the
   household. The invite code is shown in **More**.
2. Natascha signs in on her phone and taps **Join with a code**.
3. On iPhone: open the link in Safari, **Share > Add to Home Screen**, then
   open it from the icon.

## How data is stored

- Personal rows carry `user_id`; shared rows carry `household_id`. Row-level
  security is on for every table.
- Records are dated and kept, never overwritten. Tables only allow reading and
  adding rows; a change (such as a new theme) adds a new row and the newest
  wins. Leaving a household stamps `left_at` rather than deleting anything.
- **More > Your data** exports everything as JSON. Importing only adds records
  whose id isn't already stored, so it never overwrites.

## Project layout

```
src/
  areas/        one *.area.tsx file per tab; new areas are picked up automatically
  components/   ui.tsx (shared components), TabBar.tsx, MihrabFrame.tsx
  lib/          supabase, auth, settings, household, inbox, backup, date
  screens/      one screen per area, plus SignIn and HouseholdSetup
  styles.css    design tokens (light in :root, dark in .theme-dark)
supabase/migrations/   SQL to run in Supabase
```

## Not built yet

Web Push reminders (the `push_subscriptions` table is ready), and every module
after step 1: Lift Log, Fuel Log, Workflow, Meal Prep, Calendar, Faith and the
full Home screen. See the build order in the brief.
