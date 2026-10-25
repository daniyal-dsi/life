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

## Conventions
- Colours, radii and fonts come only from the tokens in `src/styles.css`
  (CSS variables, light in `:root`, dark in `.theme-dark`) via the names in
  `tailwind.config.js`. No hard-coded hex values in components.
- Two users, each with their own login. Personal rows carry `user_id`;
  shared rows (Meal Prep plan, meals, ingredients, shopping list, Masjid
  Mubarak times, dua library) carry `household_id`. RLS on every table.
- Records are dated and kept, never overwritten, so history can be analysed.
- Weeks run Monday to Sunday. Times are UK time.
- If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, run in demo
  mode on local data with a "Not connected" banner.

## Secrets
Never put keys in the repo, in code, or in chat. Supabase values go into
Vercel environment variables; the USDA key lives only in a server-side
Vercel function; inbox tokens are never logged.

## Parked
Life Analytics module: do not build until Daniyal confirms.
