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
  module's tables here), `local.ts` (demo-mode append-only storage), `date.ts`.
- `supabase/migrations/`: numbered SQL files, run in order in the Supabase SQL
  editor. Add a new file per step; never edit one that has been run.

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

## Secrets
Never put keys in the repo, in code, or in chat. Supabase values go into
Vercel environment variables; the USDA key lives only in a server-side
Vercel function; inbox tokens are never logged.

## Parked
Life Analytics module: do not build until Daniyal confirms.
