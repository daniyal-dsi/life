# Life Organiser — notes for Claude Code

A personal installable web app (PWA) for Daniyal and his wife Natascha.

## Read these first
- `docs/BRIEF.md` — the build brief: decisions, design tokens, build order and
  one prompt per module. When asked to "do step N", follow that step's prompt.
- `docs/prototype.html` — the approved clickable prototype (v2 "sharp modern"
  design, Faith page in the mihrab frame). Open it in a browser and match its
  look and behaviour. It is a reference only; never ship it or import from it.

## Stack
Vite 5 + React 18 + TypeScript (strict) + Tailwind 3 + React Router 6 +
lucide-react + vite-plugin-pwa. Supabase (Postgres, magic-link auth, RLS).
Hosted on Vercel. Path alias `@` -> `src`.

## Layout
- `src/areas/*.area.tsx`: one file per area (id, path, label, icon, order,
  `dock`). `src/areas/index.ts` globs them, so Finance, Learning or Personal is
  added by adding one file with `dock: false`; it appears in the side bar,
  More and Home's "Coming next" without touching other code. The phone dock
  holds the six `dock: true` areas.
- `src/components/ui.tsx`: Page, Card (`dark` = hero card), Button (52px),
  IconButton (40px), Header, UnderlineTabs (3px underline in the module
  colour), Segmented, Badge (PR / P1 / P2 / P3), ProgressBar, ProgressRing,
  StatTile, ModuleCard (coloured `.kcard`), EmptyState, BottomSheet, Field,
  Notice, SectionTitle. Use these before writing new ones.
- `src/components/TabBar.tsx` (dock on phones, SideBar from `lg`),
  `src/components/MihrabFrame.tsx` (wraps every Faith page; also exports
  `StarMedallion` and `star8`).
- `src/lib/`: `supabase.ts` (client or null in demo mode), `auth.tsx`
  (magic link + 6-digit code), `settings.ts` (append-only settings, theme),
  `household.tsx`, `inbox.ts`, `backup.ts` (export/import; add each new
  module's versioned tables to `VERSIONED_TABLES`), `local.ts` (demo-mode
  append-only storage), `date.ts`, `versioned.ts` (see below).
- `src/modules/<module>/`: each module owns its data and screens: `types.ts`,
  `store.tsx` (provider + hook), pure logic such as `stats.ts`, `seed.ts`,
  sheets and the main screen. Lift Log is the pattern to copy.
- `src/components/Sortable.tsx`: drag-to-reorder list (handle, touch, mouse
  and arrow keys); used for Workflow milestones.
- Module sub-screens use nested routes under the area path (Workflow:
  `/work`, `/work/b/:id`, `/work/p/:id`), inside the module's provider.
- `src/modules/calendar/`: planner (step 6a). `time.ts` (pure: work hours per
  date, overlap lanes; tested by `time.test.ts`), `buckets.ts` (block colours),
  `Calendar.tsx` (timeline and pointer drag, ported from the prototype),
  `BlockSheet.tsx`, `UpNext.tsx` (Home). It reads Workflow and Lift Log through
  their providers with `seed={false}`, which never adds sample data. Gym blocks
  link to `/health?m=lift&start=<template id>`.
- `src/components/charts.tsx`: LineChart (hover readout + table view) and
  Donut (legend with shares). Chart colours are validated tokens (`--g-*` for
  muscle groups); run the dataviz validator before adding a new palette.
- `supabase/migrations/`: numbered SQL files, run in order in the Supabase SQL
  editor. Add a new file per step; never edit one that has been run. Remind
  Daniyal to run each new file; the app can't do it.

## Editable data: versioned records
Anything a person can edit or delete uses `src/lib/versioned.ts`. Tables have
`id, entity_id, user_id, data jsonb, deleted, created_at`; a save appends a
version, a delete appends one with `deleted = true`, and `currentOf()` folds
them (newest wins). Starter data uses `stableId()` so seeding is idempotent.
Add `*_current` views with `security_invoker = true` for analysis.
Household-shared tables (Meal Prep) add `household_id`: pass `householdId` to
`useVersionedTables()` and use the `is_household_member()` RLS policies (see
0006); seed with ids keyed by the household so either person can seed it.
A module store wraps `useVersionedTables()` (`src/lib/useVersioned.ts`), which
loads the tables, seeds on first use and appends versions; see the Lift Log
and Fuel Log stores. `dataOf()` strips ids before writing a new version.
Parse typed numbers with `parseDecimal()` (`src/lib/number.ts`), which
accepts "82,5".

## Tokens
- Colours are space-separated RGB in CSS variables, so Tailwind opacity works
  (`bg-violet/20`). Main names: bg, surface, line, line2, chip, segbg, ink,
  muted, hero, coral, green, sun, violet, rose, faith, gold, niche, each with
  `-soft` / `-ink` (and some `-hi`) variants; btn / btn-text; tab-*.
- Radii: chip 8, ctl 10, btn 12, card 16, hero 18, dock 20.
- Fonts: `font-display` (Bricolage), `font-body` (DM Sans), `font-arabic`
  (Amiri). Use the `.disp` class for headings and big numbers: it applies
  Bricolage at 800 in light and 700 in dark.
- Dark mode uses colour as tints and glows (`--glow-*` shadows, `.kcard`
  tints), never grey-only screens.

## Conventions
- Colours, radii and fonts come only from the tokens in `src/styles.css`
  (CSS variables, light in `:root`, dark in `.theme-dark`) via the names in
  `tailwind.config.js`. No hard-coded hex values in components.
- Two users, each with their own login. Personal rows carry `user_id`;
  shared rows (Meal Prep plan, meals, ingredients, shopping list, Masjid
  Mubarak times, dua library) carry `household_id`. RLS on every table.
- Records are dated and kept, never overwritten, so history can be analysed.
  Tables get SELECT and INSERT policies only; a change is a new row and the
  newest wins. Import adds rows by id and skips ids already stored.
- Weeks run Monday to Sunday. Times are UK time.
- Supabase URL/key come from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`,
  falling back to the Vercel integration's `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`envPrefix` in `vite.config.ts`). Never widen
  that prefix list. If both are missing, run in demo
  mode on local data with a "Not connected" banner.

## Reminders (Web Push)
- `supabase/functions/send-reminders/index.ts` (Deno Edge Function), with
  pure, Node-tested helpers in `supabase/functions/_shared/`: `webpush.ts`
  (RFC 8291 encryption + VAPID, Web Crypto only) and `reminders.ts` (which
  reminders fire in a given UK hour). `npm test` runs both test files.
- Client: `src/lib/push.ts`, `src/screens/RemindersCard.tsx`, and
  `public/push-sw.js` (imported into the generated service worker).
- Reminder choices live in settings (`settings.reminders`); `push_log`
  stops repeats. Add new reminder kinds in `reminders.ts` and its test.

## Nutrition data (shared by Fuel Log and Meal Prep)
- `src/lib/nutrition/`: `cofid.ts` (loads and searches
  `public/data/cofid-2021.json`), `usda.ts` (calls `api/usda.ts`: `?q=` search,
  `?id=` portion weights), `off.ts` (Open Food Facts by barcode, with serving
  size), `NutritionFinder.tsx`, `BarcodeScanner.tsx` (ZXing, lazy-loaded into
  its own `barcode-*` chunk and kept out of the PWA precache). Keep the OGL
  attribution line wherever results are listed.
- Fuel Log's `FoodSheet.tsx` is the one "Log food" sheet (Fuel Log and Home).
  Database foods are saved to My Foods once (matched on `source` + `ref`) with
  `per_100g` and serving size; entries copy the values and record `grams` or
  servings (`amountLabel()`).
- Meal Prep's `guess.ts`: aisle, cooked weight (same 100 / shrinks 75 /
  absorbs 250, from the name) and grams per unit (USDA portions, then
  `UNIT_DEFAULTS`; "whole" only from the database or by asking). Only g and
  ml count without a saved weight; recipe lines ask inline otherwise.
- `api/`: Vercel functions (Web `GET(request)` handlers); every file there
  becomes an endpoint, so tests live in `test/`. They check the
  caller's Supabase token before using any server-side key.

## Secrets
Never put keys in the repo, in code, or in chat. Supabase values go into
Vercel environment variables; the VAPID private key and CRON_SECRET live only
in Supabase Edge Function secrets; the USDA key (`USDA_API_KEY`) lives only in a server-side
Vercel function; inbox tokens are never logged.

## Parked
Life Analytics module: do not build until Daniyal confirms.
