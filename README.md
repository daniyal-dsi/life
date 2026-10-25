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
2. **Run the migrations, in order.** In the dashboard open **SQL Editor > New
   query**, paste the whole of each file in [`supabase/migrations/`](supabase/migrations)
   and click **Run**, one file at a time: `0001_foundations.sql`, then
   `0002_liftlog.sql`, `0003_fuellog.sql`, `0004_workflow.sql`, `0005_reminders.sql`, `0006_mealprep_library.sql`, `0007_mealprep_plan.sql`, and so on. Each file runs once; when a new step adds a
   file, run just that one. (With the Supabase CLI you can instead run
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
2. Give the app the Supabase URL and public key, in either of two ways:
   - **Supabase integration (easiest):** connect the Vercel project to the
     Supabase project (Vercel **Integrations**, or Supabase **Project Settings >
     Integrations**). It adds `NEXT_PUBLIC_SUPABASE_URL` and
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which the app reads as they are.
   - **By hand:** under **Project Settings > Environment Variables** add, for
     Production, Preview and Development:

     | Name | Value |
     | --- | --- |
     | `VITE_SUPABASE_URL` | your Project URL |
     | `VITE_SUPABASE_ANON_KEY` | your anon public key |

   If both are set, the `VITE_` values win. Never rename the integration's
   server-only variables (`SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_*`) to start
   with `VITE_` or `NEXT_PUBLIC_`: that would put them in the app for anyone to read.
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
- Things you can edit or delete (workouts, templates, exercises) are
  **versioned**: each save adds a new version with the same `entity_id`, and a
  delete adds a version marked `deleted`. The `*_current` views in Supabase
  show the latest state; `liftlog_sets` lists every logged set for analysis.
- **More > Your data** exports everything as JSON. Importing only adds records
  whose id isn't already stored, so it never overwrites.

## Project layout

```
src/
  areas/        one *.area.tsx file per tab; new areas are picked up automatically
  components/   ui.tsx (shared components), TabBar.tsx, MihrabFrame.tsx
  lib/          supabase, auth, settings, household, inbox, backup, date, versioned
  modules/      one folder per module (liftlog/ ...): data, logic and screens
  screens/      one screen per area, plus SignIn and HouseholdSetup
  styles.css    design tokens (light in :root, dark in .theme-dark)
supabase/migrations/   SQL to run in Supabase
```

## Not built yet

The rest of Meal Prep (5c Fuel Log link, 5d nutrition databases), then
Calendar, Faith and the full Home screen. See
the build order in the brief.

## Lift Log (step 2)

In **Health > Lift Log**. The first time each person opens it, it adds a
starter library of 15 exercises, Push/Pull/Legs templates, and three weeks of
sample workouts (with two PRs) so the charts have something to show. Tap
**Clear sample workouts** to remove the samples; they don't come back.

## Fuel Log (step 3)

In **Health > Fuel Log**. The first time each person opens it, it adds a
sample profile, a food library, one fully logged day (today) and a few weeks
of weigh-ins. Set your own details under **Profile**; **Clear sample data**
removes the sample meals and weigh-ins.

- Daily target: Mifflin-St Jeor resting rate × activity level, minus 15% to
  lose or plus 10% to gain. Protein 2 g per kg, fat 25% of calories, carbs
  the rest.
- Changing your profile saves a new version from that day on, so past days
  are still scored against the target they had.
- Each logged food keeps a copy of its calories and macros, so editing a food
  in **My foods** doesn't change past days.
- One weigh-in per day; logging the same day again replaces it.

## Workflow (step 4)

In the **Work** tab. The first time each person opens it, it adds the three
buckets (MKA UK, Business, AI Side Hustles), a "you" person, and sample
people, projects and milestones. **Clear sample work** removes the samples,
including anything you added to a sample project; buckets and you stay.

- Overview: active projects, P1 count, due this week, due today / overdue /
  completed (tap to list them), one card per bucket, and **Needs attention**
  (overdue, due in the next 3 days, and P1 work due within a week).
- Bucket: projects filtered by All / P1 / In progress / Done.
- Project: milestones with owner and due date; tick to complete, drag the
  handle (or use the arrow keys) to reorder, tap to edit.
- People are names only and can be reused across projects.

## Reminders (phone notifications)

Reminders are sent by a Supabase Edge Function, `send-reminders`, which a
Supabase schedule runs every hour. Times are UK time:

| When | Reminder |
| --- | --- |
| 08:00 | Milestones due today; P1 milestones due tomorrow |
| 18:00 | Milestones that became overdue today |
| Sunday 19:00 | Weekly summary |
| Thursday 18:00 / daily 20:00 | Nudges: no workout yet this week / calories not logged today |

Each person picks which ones they get in **More > Reminders**. Sample data
never triggers reminders, and each reminder goes out at most once a day.

### One-off setup

1. **Database.** Run `supabase/migrations/0005_reminders.sql` in the SQL Editor.
2. **Keys.** In Terminal, in this folder, run
   `node scripts/generate-reminder-keys.mjs`. It prints the keys and says where
   each one goes:
   - Vercel environment variable `VITE_VAPID_PUBLIC_KEY` (then redeploy).
   - Supabase **Edge Functions > Secrets**: `VAPID_PUBLIC_KEY`,
     `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` plus your email) and
     `CRON_SECRET`.
3. **Deploy the function.** In Terminal: `npx supabase login` (opens your
   browser once), then
   `npx supabase functions deploy send-reminders --project-ref YOUR-PROJECT-REF --no-verify-jwt`.
   (`--no-verify-jwt` because the schedule signs in with `CRON_SECRET` and the
   app's "Send a test" checks your sign-in itself.)
4. **Schedule.** Open `supabase/setup/schedule_reminders.sql`, replace the two
   placeholders in the SQL Editor (not in the file), and run it.
5. **Phone.** Open the app from the home-screen icon, go to **More >
   Reminders**, tap **Turn on reminders**, allow notifications, then
   **Send a test**. Natascha does the same on her phone.

On iPhone, notifications need iOS 16.4 or later and only work in the app
opened from the home screen.

### Checking it

In the SQL Editor: `select * from push_log order by sent_at desc limit 20;`
shows what was sent, and `select * from cron.job_run_details order by
start_time desc limit 5;` shows the hourly runs.

The encryption and reminder rules have tests: `npm test`.

## Meal Prep (step 5a: library)

In **Health > Meal Prep**, shared by everyone in the household. The first
time anyone opens it, it imports the seven meals and their ingredients from
"Meal Planning.xlsx" (amounts are cooked weight per portion).

- **Meals:** per-portion calories and macros that update as you edit; lines
  that can't be counted (no amount, no unit size, no nutrition) are listed.
  An optional recipe link (with or without https://) shows an **Open recipe**
  button.
- **Ingredients:** aisle, staple, cooked weight from 100 g raw, grams per
  unit, and nutrition per 100 g cooked with its source. Vague names such as
  "Chicken" or "Rice" can't be saved; imported Veg, Tuna and Greek yoghurt are
  flagged **Type?** with suggestions.
- Imported nutrition values are starter values (marked "starter") to check
  against the food databases, which arrive in step 5d.

## Meal Prep (step 5b: week plan and shopping list)

- **Plan:** Monday to Sunday with breakfast, lunch and dinner. Tap a slot to
  pick a meal and who's eating (default: everyone in the household). Pick
  more days under **Batch cook** to put the same meal in that slot on them;
  the same meal in the same slot across the week is cooked once. **Copy last
  week** replaces this week with last week's plan; **Clear week** empties it.
- **Cook plan** lists each cook with its days and portions. **Your daily
  average** shows the macros of the planned meals you eat against your Fuel
  Log targets.
- **Shopping list** (shared): one portion per person per planned meal,
  grouped by aisle. Cooked weights are converted to raw weights to buy using
  each ingredient's cooked weight from 100 g raw. Tap an amount to change it
  (the calculated amount stays visible); tick items off (both phones see the
  ticks after returning to the app); add other items; staples sit in their
  own section; **Share list** sends what's left as plain text.

