# Life Organiser App: Build Brief

Oct 24, 2026 · @Daniyal

## Aim and decisions

One personal app that gives a daily "today" view, quick logging and a big-picture overview across Health and Work, with room to add Finance, Learning and Personal later.

| Decision | Choice |
| --- | --- |
| Daily purpose | Today view, quick logging and overview, all three |
| Structure | One app, mixed Home screen plus a section per area |
| Areas now | Health (Lift Log, Fuel Log) and Work (Workflow) |
| Areas later | Finance, Learning, Personal |
| Theme | Light theme from the Workflow mockup, plus a matching dark theme (toggle) |
| Devices | Phone and laptop, synced: installable web app on Vercel with a Supabase database |
| Cross-module | Nudges and a weekly summary |
| Reminders | Phone push notifications for due milestones |
| People in Workflow | Names only; single user, one-time sign-in per device |
| Badges | Lift Log: PR badge means personal record. Workflow: priority badge (P1, P2, P3) |

Weeks run Monday to Sunday for the lift streak, "this week" stats and the weekly summary.

## Structure

The app is a single mobile-first web app with a bottom tab bar. Each module owns its data and screens, and all of them share one design system and one storage layer.

| Tab | Contains | Hero stat on Home |
| --- | --- | --- |
| Home | Today view, nudges, weekly summary | n/a |
| Calendar | Day and week planner, two-way synced with Google Calendar | Up next today |
| Health | Lift Log, Fuel Log, Meal Prep | Lift streak; calories left today; meals planned and items to buy |
| Work | Workflow: buckets, projects, milestones, people | P1 items and milestones due this week |
| Faith | Prayer: five daily prayers, Quran recitation, duas | Next prayer and today's on-time count |
| More | Settings, theme toggle, export/import, future areas | n/a |

Shared pieces: theme tokens (light and dark), big-number tile, progress bar and ring, badge component, bottom sheet for quick logging, and a single data store with one collection per module. Finance, Learning and Personal later become new tabs or sections that reuse these pieces.

## Two users

Daniyal and Natascha each sign in on their own phone and get their own version of every module; only Meal Prep is shared, through a household both belong to.

| Area | Personal to each person | Shared by the household |
| --- | --- | --- |
| Profile and settings | Name, theme, reminders | None |
| Fuel Log | Body profile, calorie and macro targets, food log, weight | Meal Prep meals appear in both food lists |
| Lift Log | Exercises, workouts, PRs | None |
| Workflow | Buckets, projects, tasks, people | None |
| Calendar | Blocks and the Google account it syncs with | None |
| Meal Prep | "I ate this" logs, with servings adjusted per person | Meal and ingredient library, week plan, who is eating each meal, shopping list |
| Faith | Prayer logs and scores, Quran recitations, dua counts, Asr and display settings | Masjid Mubarak times, dua library |

Each planned meal records who is eating it; the shopping list buys one portion per person per meal.

## Design

The light theme is the Workflow mockup's look, applied to the whole app. The dark theme keeps the same palette, fonts and layout on deep backgrounds, using colour as tints and glows rather than solid blocks, so it feels sleeker but still lively.

| Token | Light | Dark |
| --- | --- | --- |
| Page background | #F4F2EE (warm off-white) | #111017 |
| Card surface | #FFFFFF, border #E7E3DB | #1A1822, border #2A2734 |
| Hero card | #121117, muted text #A3A0AE, dividers #2C2A35 | #1F1B2E, 1px border #6C5CE7 at 40% |
| Text / muted | #121117 / #6B6875 | #F2F0F7 / #A09CB0 |
| Violet (primary) | #6C5CE7, light #8B7DFF, tint #ECE9FF | #8B7DFF, tint #2A2545 |
| Coral | #FF6B4A | #FF8A6E on tint #2C1914 |
| Sun | #FFC83D, tint #FFF3D1 | #FFD565 on tint #2B230F |
| Green (done, on target) | #2FBF7F solid; #0F7A52 on #DDF5E8 | #4ADE9B on #10291E |
| Rose (overdue, P1) | #E11D48 solid, tint #FFE4EA | #FB4D73 solid, tint #2E1219 |
| Faith emerald and gold | #0E4D42 emerald, #C9A14A gold, #E8C979 light gold, niche #FBF7EE | #123F37 emerald, #D4B05A gold, niche #15201D |
| P2 badge | #8A5300 on #FFE9C2 | #FFC83D on #33270E |
| Primary button | #121117, white text | #F2F0F7, #16141F text |

- **Fonts:** Bricolage Grotesque for headings and big numbers (weight 800 in light, 700 in dark), DM Sans for everything else.
- **Shapes:** sharp and modern. Cards 16px corners (hero cards 18px), buttons 52px tall with 12px corners, chips and badges 8 to 10px, icon buttons as 40px squares with 12px corners. Thin 1px dividers between stats and list rows instead of extra boxes.
- **Colour identity:** Lift Log coral, Fuel Log green, Meal Prep sun, Workflow violet, Faith emerald and gold. Buckets: MKA UK coral, Business violet, AI Side Hustles sun; Calendar blocks use their bucket's colour.
- **Coloured cards:** solid colour blocks in light; in dark, a tinted card with the icon, big number and progress bar in the full colour.
- **Badges never share a colour:** PR (personal record) is sun yellow with a trophy icon; P1 is rose with a bolt icon; P2 is an amber tint; P3 is an outline.
- **Keep dark engaging:** same palette, a soft glow behind hero numbers, coloured progress bars and charts, no grey-only screens.
- **Page headers:** an 11px uppercase label (date or area) above a 30px Bricolage title, with square icon buttons on the right.
- **Sub-tabs:** Lift Log, Fuel Log and Meal Prep are text tabs with a 3px underline in the module's colour; other switches are a grey segmented control with a white active pill.
- **Tab bar:** a dark floating dock with six tabs (Home, Calendar, Health, Work, Faith, More); the active tab is a white tile.
- **Home:** a dark "today at a glance" card with hairline dividers between its three numbers, an Up next list, and Your areas as a 2×2 grid of coloured module cards, each with a big number and a progress bar.
- **Faith:** each Faith page is framed by a mihrab: a pointed arch at the top with a gold finial and hanging lamp, emerald spandrels with a faint star pattern, and double gold lines running down both sides to the bottom of the page. Prayer rows use eight-point star medallions.
- **Reference:** the approved mockups are in Figma, [Life Organiser · Faith module](https://www.figma.com/design/xkKcdqmTOG8q2kfDwsD4vu) (Faith page) and its Modules · v2 proposal page (Home, Lift Log, Fuel Log, Meal Prep, Calendar, Workflow).

## Build order

Build in this order, one step per Claude session or message, and check each step on your phone before moving on.

1. **Foundations.** Shell, bottom tab bar, light/dark toggle, design tokens, shared components, synced data layer with two users and a shared household, export/import.
2. **Lift Log.** Self-contained and used at the gym, so it proves the shell and the storage first.
3. **Fuel Log.** Profile and targets, then food library, daily log, history and weight trend.
4. **Workflow.** Buckets, projects, milestones, people, priority badges, due-date reminders.
5. **Meal Prep.** Shared meal library, week plan, shopping list and nutrition lookup, linked to Fuel Log.
6. **Calendar.** Day and week views, drag-and-drop bucket blocks, then the Google Calendar sync.
7. **Faith.** Prayer times and logging first, then Quran recitation, then duas and the counter.
8. **Home screen.** Hero stat per module, today view, nudges and weekly summary.
9. **Polish and real data.** Replace sample data, test one-handed on a phone, fix friction.
10. **Use it for two weeks,** then add Finance, Learning and Personal one at a time.

### Step 1 prompt: foundations

```markdown
Build the shell of a personal life-organiser app as an installable web app (PWA). Two users: me (Daniyal) and my wife Natascha, each with our own login and personal data, sharing one household.

Tech and hosting
- React + Vite + Tailwind, in a GitHub repo, deployed to Vercel.
- Supabase for the database and sign-in: email magic link, once per device, staying signed in. Row-level security: personal rows are readable and writable only by their owner; shared rows only by members of the household.
- Web app manifest and service worker so it installs to my phone's home screen and opens full screen.
- Web Push: a "Turn on reminders" button (permission must be asked from a tap) that subscribes the device and saves the subscription in Supabase. A Supabase scheduled job runs hourly and sends due notifications through an Edge Function. Times are UK time.

Layout
- Bottom tab bar on phone: Home, Calendar, Health, Work, Faith, More. Side bar on laptop widths.
- Weeks start on Monday everywhere.

Design
- Light theme by default, matching my Figma mockups: page #F4F2EE, white cards with #E7E3DB borders, dark hero card #121117, violet #6C5CE7, coral #FF6B4A, sun #FFC83D, green #2FBF7F, rose #E11D48, Faith emerald #0E4D42 and gold #C9A14A. Sharp corners: cards 16px, buttons 52px tall with 12px corners, chips 8 to 10px, 1px dividers. Headers: 11px uppercase label over a 30px title. Bricolage Grotesque 800 for headings and big numbers, DM Sans for body.
- Dark theme with the same palette on #111017 backgrounds and #1A1822 cards, colours used as tints and glows, Bricolage at 700. Toggle in More; default follows the system setting.
- All colours, type, spacing and radius defined as shared tokens.

Shared components
- Big-number stat tile, progress bar, progress ring, coloured module card, badge (PR badge for personal records; P1/P2/P3 priority badges, never the same colour), card, bottom sheet for quick entry, empty state.

Data
- One set of tables per module (liftlog, fuellog, mealprep, calendar, workflow) plus settings, push subscriptions, and households with their members. Every personal row has a user_id; every shared row has a household_id. Records are dated and kept, never overwritten, so history can be analysed later. Export and import of everything as JSON.
- Placeholder screens for each tab. New areas (Finance, Learning, Personal) must be addable as new tabs without changing existing code.
```

### Step 2 prompt: Lift Log

Use the Lift Log spec below, built inside the Health tab and using the shared components and data layer.

### Step 3 prompt: Fuel Log

Use the Fuel Log spec below, built inside the Health tab beside Lift Log.

### Step 4 prompt: Workflow

Use the Workflow spec below, built inside the Work tab, with due-date reminders as described in the reminders section.

### Step 5 prompt: Home screen

Use the Home screen spec below. Build it only after all three modules exist so it can read their data.

## Module specs

Paste the matching block as the prompt for its build step. All three use the shared theme (light and dark) and shared data layer from step 1.

### Lift Log

```markdown
Build "Lift Log" inside the Health tab. It tracks my gym workouts and automatically detects personal records.

- Exercise library pre-filled with about 15 common exercises (bench press, squat, deadlift, overhead press, pull-ups, barbell row, etc.) grouped by muscle group (chest, back, legs, shoulders, arms, core). I can add my own.
- Workout templates: I can create, name, edit and delete my own workouts (e.g. Push, Pull, Legs), each an ordered list of exercises with target sets and reps. Starting a workout from a template pre-fills its exercises, with my last weights shown as hints. Pre-load Push, Pull and Legs templates from the sample exercises.
- Log a workout: pick a date, add exercises, and for each exercise enter sets as weight x reps, with an optional note.
- Automatic PR detection: whenever a set beats my previous best weight for that exercise, mark it with a PR badge (personal record) on the workout and update a Personal Records board showing my current best for every exercise.
- Streak counter as the hero stat: consecutive weeks (Monday to Sunday) with at least 3 logged workouts.
- Dashboard: current streak, workouts this month, total volume lifted this week (weight x reps summed), most recent PRs, and a line chart of progression on a chosen lift over time.
- Donut chart of this month's training volume by muscle group.
- Full workout history, newest first, each entry expandable.
- Pre-load 3 weeks of realistic workout history including 2 personal records so the dashboard, streak and charts look alive. I will replace it with my own training.
- Big numbers, PR badges that visibly stand out, easy to use between sets on a phone.
```

### Fuel Log

```markdown
Build "Fuel Log" inside the Health tab. It calculates my daily calorie target from my body stats and tracks everything I eat against it.

- One-time profile setup: body weight (kg), height (cm), age, sex, activity level (sedentary / light / moderate / very active), goal (lose weight / maintain / gain).
- Daily calorie target from the Mifflin-St Jeor formula adjusted by activity level, with a 15% deficit for losing and a 10% surplus for gaining, plus a suggested protein/carbs/fat split in grams.
- "My Foods" library: I add groceries and meals manually with name, calories per serving, and optional protein/carbs/fat per serving.
- Daily log: pick foods from my library, set number of servings, assign to breakfast / lunch / dinner / snacks.
- Today dashboard: big progress ring of calories eaten vs target, "calories left today" as the hero number, protein/carbs/fat progress bars, and today's meals listed by mealtime.
- History: week view of past days colour-coded by whether I stayed within target, plus a weight log with a trend chart.
- Editing my profile recalculates targets.
- Pre-load a sample profile and one fully logged example day (eggs, rice, chicken breast, a snack). I will replace it with my own data.
```

### Workflow

```markdown
Build "Workflow" inside the Work tab. It is where I distribute and track my work.

- Three fixed buckets: MKA UK, Business, AI Side Hustles. Allow renaming and adding more later.
- Data model: Project (bucket, name, description, priority P1/P2/P3, status Planning/In progress/Blocked/Done, due date, people), Milestone (project, title, owner, due date, done, order), Person (name, initials, optional role; names only, reusable).
- Overview screen: large count of active projects, P1 count, items due this week, one card per bucket with its project count, milestones left, progress bar and next due date, and a "Needs attention" list of P1 and overdue or soon-due items.
- Bucket screen: stats, filter chips (All / P1 / In progress / Done), project cards with priority badge, status, due date, progress fraction, owner avatars and the next milestone.
- Project screen: milestone steps with the person responsible for each, tick to complete, drag to reorder, and an add-milestone field.
- Priority badges (P1, P2, P3) must be visible at a glance. These are priority badges, not personal records.
- Due-date reminders for milestones (see reminders section).
```

### Meal Prep

```markdown
Build "Meal Prep", a third Health module next to Lift Log and Fuel Log, in the same design (its colour is sun #FFC83D). Everything here is shared by the household (Daniyal and Natascha) except what each person logs as eaten.

Meals and ingredients
- A meal library: name, type (breakfast, lunch or dinner) and ingredients. Each ingredient line has a quantity (optional), a unit (g, ml, tsp, tbsp, cup, tin, whole, clove, bunch) and is a COOKED weight per portion.
- An ingredient library: name, aisle (meat & fish, fruit & veg, dairy & eggs, cupboard, herbs/spices/sauces), staple yes/no, cooked weight from 100 g raw (e.g. chicken breast 75), grams per unit for tin/whole/clove/bunch/cup/tbsp/tsp, and nutrition per 100 g cooked (kcal, protein, carbs, fat) with its source.
- Vague names are blocked until made specific: "Chicken" must become "Chicken breast" or "Chicken thigh"; same for beef, lamb, mince, fish, veg, pasta, rice, cheese, yoghurt, milk. Imported ingredients that are still vague carry a "Type?" flag with a "Pick type" button that offers database matches.
- Recipe link: each meal can store one optional link (often Instagram, TikTok or YouTube). Accept pasted links with or without https://, reject anything that isn't a web address, and show the site name. Opening a planned meal shows an "Open recipe" button that opens the link in a new tab, so whoever is cooking can follow it; plan slots with a link show a small link icon.
- Recipe editor: change any amount or unit, add or remove ingredients, and see per-portion kcal, protein, carbs and fat update as I type. Ingredients without an amount, unit size or nutrition are listed as not counted.

Nutrition data (all free)
- Primary: the UK Composition of Foods Integrated Dataset (CoFID, McCance and Widdowson, gov.uk spreadsheet), imported once into Supabase and searched locally.
- Backup: USDA FoodData Central API (free key, kept server-side in a Vercel function, never in the browser or repo).
- Branded items: Open Food Facts by barcode, using the phone camera.
- Manual entry from the pack as a last resort.
- Adding an ingredient: one search box shows my own ingredients first, then database results; tapping a result adds it with its macros.

Week plan
- Monday to Sunday with breakfast, lunch and dinner slots. Week navigation, "copy last week" and "clear week".
- Each slot: a meal plus who is eating it (Daniyal, Natascha or both; default both).
- Batch cooking: put the same meal in the same slot on several days; it is cooked once and shown as a batch.
- A cook plan listing each cook with its portions and days, and a daily average of MY macros against my Fuel Log targets.

Shopping list (shared)
- Built from the week plan: one portion per person per planned meal, grouped by aisle.
- Converts cooked weights to raw weights to buy using each ingredient's cooked-weight figure.
- Ingredients with no quantity show the name only. Every amount can be edited, and an edited amount shows what it was calculated as.
- Tick items off (shared between us), add extra items, a collapsible Staples section, untick all, and share the list as plain text.

Fuel Log link
- Every meal is also a food in each person's Fuel Log library, kept up to date when the recipe changes.
- Planned meals show in Fuel Log and on the plan with "I ate this" for the people eating them. It opens a servings stepper and logs only to the signed-in person's Fuel Log. Manual logging still works.

Starting data
- Import my seven meals from "Meal Planning.xlsx" (Tuna Salad, Chickpea Salad, Chicken Salad, Beef + Potato + Veg, Chicken + Potato + Veg, Lamb Bhuna + Rice + Veg, Chicken Pasta). Plain "Chicken" is chicken breast; "pepper" is bell pepper except Chickpea Salad's "Pepper", which is black pepper. Flag Veg, Tuna and Greek yoghurt as needing a type.
```

### Calendar

```markdown
Build "Calendar", its own tab between Home and Health, in the same design. It is personal to each user: Daniyal and Natascha each have their own calendar linked to their own Google account. Very easy to use, built for constructing my week.

Views
- Day view (06:00 to 23:00 timeline, with a now-line) that pops out to a week view (Monday to Sunday). Tapping a day in week view opens that day.

Planning with buckets
- A palette of draggable chips: my Workflow buckets, plus a Work 9-to-5 bucket and a Gym bucket.
- Drag a chip onto a time to create a block (snaps to 15 minutes). On phones, press and hold (about 0.4 s) to pick up a chip or block, with a small lift and vibration; a normal swipe still scrolls the page. Also allow: tap a chip, then tap a time.
- Drag a block to move it (also across days in week view); drag its bottom edge to resize.
- Dropping a Workflow bucket opens a pop-up asking which task I'll work on, listing that bucket's open tasks (or "no specific task"). The block only shows the task; it does not tick anything off in Workflow.
- Gym: a 1.5-hour block that asks which of my Lift Log workout templates I'll do (e.g. Push, Pull, Legs). Tapping the block at the gym opens Log workout pre-filled from that template.
- Work: added automatically 09:00 to 17:00 every weekday. I can change the times for one day, set new usual hours, or mark a day as not working. I can also add work on a weekend.
- Other buckets default to 1 hour. Tapping empty space opens "Plan a block" with the bucket list.

Google Calendar (two-way)
- Connect my Google account with OAuth (calendar scope), tokens stored server-side in Supabase.
- Blocks I create, move or delete are written to my MAIN Google calendar, titled like "Business · Draft copy" or "Gym · Push".
- My Google events show in the app as dashed blocks around which I plan; edits made in Google sync back.
- Sync on open and on a schedule, using Google's incremental sync, and avoid duplicating events the app created.
- Note: while the Google OAuth app is in Testing mode, refresh tokens expire after 7 days; check the current publishing and verification rules before going live.

Data and Home
- Store every block in Supabase with its date, times, bucket, task and Google event id, so the history can be analysed later.
- Home shows "Up next today": the next three blocks or events.
```

### Faith

```markdown
Build a "Faith" tab containing the Prayer module, with three sections switched by a segmented control: Prayers, Quran and Duas. Each person has their own logs; the Masjid Mubarak times and the dua library are shared by the household.

Design
- Every Faith page is framed by a mihrab (mosque prayer niche): a pointed arch at the top of the page with a gold star finial and a small hanging lamp, emerald (#0E4D42) spandrels with a faint gold eight-point star pattern, gold capitals where the arch meets the sides, and double gold lines (#C9A14A) running down both sides to the bottom of the page, with small gold beads on the side bands. Content sits on a warm ivory niche (#FBF7EE; dark #15201D). Match the Faith page in the Figma file.
- Prayer names show in English and Arabic (Amiri font). Prayer rows use eight-point star medallions: solid emerald with a gold tick when prayed on time, a gold dot when due now, a red cross when missed. The Hijri date sits at the top.

Prayer times
- Calculated times for the phone's current location (Fajr 18°, Isha 17°, standard Asr with a Hanafi option; high-latitude fallback for Scottish summers), computed in the app with a library such as adhan.
- Masjid Mubarak (Islamabad, Tilford) congregation times, entered by pasting the WhatsApp timings message: parse prayer names and times (12 or 24 hour, "Zuhr & Asr 1:15pm", "Maghrib: Sunset", Jumu'ah) and a "from <date>" line, show a preview, then save with its start date. Keep a history of updates. Messages arrive two ways: pasted into the app, or sent from WhatsApp through the iPhone Shortcut inbox below.
- A setting chooses whether the mosque or calculated time is shown first.

WhatsApp inbox (iPhone Shortcut)
- A Vercel API route, POST /api/inbox, that accepts JSON {text, source}. It authenticates with a per-user secret token in an "Authorization: Bearer" header. Tokens are generated in More > Connections, shown once with a copy button, can be revoked, and are never logged. Rate-limit the route and reject bodies over 10 KB.
- The route saves every message to an inbox table (user, received time, text, what it was used for), then tries the parsers. If prayer times are found it saves them as a new Masjid Mubarak update (shared with the household) and replies {ok, message: "Masjid Mubarak times updated from Mon 2 Nov"}. If nothing is recognised it replies {ok, message: "Saved to your inbox"} and the message waits in an Inbox list in More, where I can apply it or delete it.
- Build the parsers so new message types can be added later (e.g. meal ideas, tasks).
- More > Connections shows step-by-step Shortcut setup with my app address and token filled in, and a "Send a test" button.

Prayers
- Hero: the next prayer, its time and a countdown. When a prayer is due and not logged, a gold "I've prayed <prayer>" button logs it with the current time.
- Today's list: Fajr, Sunrise (marker), Zuhr (Jumu'ah on Fridays), Asr, Maghrib, Isha, each with its window, mosque time, logged time and status. Tap a prayer to log or edit it with any time, mark it as prayed at the mosque, or combine Zuhr + Asr or Maghrib + Isha (one tap logs both).
- Retrospective logging: step back through days or tap a day in the week grid.
- Scoring: on time = before the last hour before the next prayer starts (sunrise for Fajr); late = within that last hour; missed once the next prayer starts, or "made up" if logged later. Combined prayers use the combined window.
- End-of-day adherence card (on-time count out of 5 with a coloured bar per prayer) and a week grid of all prayers with a daily percentage.

Quran
- Log a recitation: date, surah, verses from and to, and rukus. Use the Ahmadiyya Quran's numbering, where Bismillah is verse 1 of each surah (except Al-Fatihah, where it already is, and At-Taubah, which has none). Work out the rukus from the verses using the Ahmadiyya Quran's ruku divisions (source them from the Quran on alislam.org), with manual override.
- Rukus this week, today, a daily streak, a weekly bar chart and recent recitations.

Duas
- Categories: when ill; in need of Allah's help; increase in rizq; when feeling down; gratitude.
- Each dua: title, Arabic, transliteration, English meaning, a source link (Ahmadiyya sources only: Al Islam, Al Hakam) and a target number of recitations. Add, edit and delete duas.
- A tap counter with a progress ring towards the target, counted per person per day, plus a free counter (33, 100 or 313).
- Start with one placeholder per category; I'll supply the duas.

Home shows a Faith card with the next prayer (or the one due now) and today's on-time count.
```

#### Setting up the WhatsApp Shortcut (once, on each iPhone)

Forwarding a WhatsApp message to the app takes two taps once this is set up. Natascha sets up her own with her token.

1. Open the Shortcuts app, tap **+**, and name the shortcut **Send to Life Organiser**.
2. In the shortcut's details, turn on **Show in Share Sheet** and set it to accept **Text**.
3. Add the action **Get Contents of URL**: the app's inbox address (shown in More > Connections), method **POST**, a header **Authorization** with the value `Bearer` plus your token, and a JSON body with **text** set to Shortcut Input and **source** set to `whatsapp`.
4. Add **Get Dictionary Value** for `message`, then **Show Notification** with that value, so you see what the app did.
5. Test it: in WhatsApp, press and hold the timings message, tap **Forward**, tap the share icon, then choose **Send to Life Organiser**.

The exact labels in Shortcuts can shift between iOS versions; the Connections page in the app will show the current steps.

## Home screen

Home answers "what matters today?" in one scroll and links into each module.

```markdown
Build the Home tab.

- Greeting and date, then a Today section with one hero stat per module: lift streak and whether I have trained today, calories left today, and P1 or due-this-week workflow items.
- Quick actions: log a workout, log a food, add a milestone.
- Nudges, shown as small cards only when relevant: no workout logged this week, calories not logged today, a P1 milestone due within 3 days, an overdue milestone.
- Weekly summary card, generated every Sunday evening and viewable on Home: workouts and volume, new PRs, days within calorie target, milestones completed and still open, and the biggest item due next week.
- Every card taps through to the relevant module.
- Leave a clear slot for future areas (Finance, Learning, Personal) so their stats can be added later.
```

## Hosting and reminders

Host it as an installable web app on Vercel, with Supabase for the database, sign-in and scheduled reminders. One link works on phone and laptop, data stays in sync, and it is the simplest route to real phone notifications. Both free tiers cover one person's use.

| Need | How it is met |
| --- | --- |
| Phone | Open the link, choose Add to Home Screen; it then opens full screen like an app |
| Laptop | Same link in any browser; install from Chrome or Edge for a dock icon |
| Sync | One Supabase database that every device reads and writes |
| Privacy | Magic-link sign-in once per device; only your account can see the data |
| Reminders | Web Push, sent by an hourly Supabase scheduled job and Edge Function |
| Cost | Free tiers at personal scale |

### Things to know

- **iPhone:** push only works after the app is added to the home screen and opened from that icon, and permission must be asked from a tap ([Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)). It needs iOS 16.4 or later. On Android, Chrome supports it directly.
- **Supabase pausing:** free projects pause after 7 days of low activity ([Supabase](https://supabase.com/docs/guides/platform/free-project-pausing)). The hourly reminder job keeps it active.
- **Why not Vercel for reminders:** its free cron runs at most once a day, and only somewhere within the scheduled hour ([Vercel](https://docs.vercel.com/docs/cron-jobs/usage-and-pricing)).
- **Why not a Claude artifact:** easy to open on both devices, but it cannot send phone notifications.
- **Login change:** the Lift Log and Fuel Log specs said no login. Data on the internet needs protecting, so this uses a one-time magic link per device.

### Proposed notifications

- 08:00 daily: milestones due today, if any.
- 24 hours before a P1 milestone is due.
- 18:00: anything that became overdue today.
- Sunday 19:00: the weekly summary.
- Nudges (no workout this week by Thursday, calories not logged by 20:00) can be switched on or off in More.

### One-off setup

- [ ] Create free GitHub, Vercel and Supabase accounts
- [ ] Build step 1, then deploy to Vercel
- [ ] On your phone, open the link, Add to Home Screen, open from the icon and tap Turn on reminders
- [ ] Set up the Send to Life Organiser Shortcut on my iPhone, and on Natascha's (steps under Faith)

## Parked for later

Two decisions to make before the real build starts.

- [ ] **Life Analytics module.** A page to look back on and evaluate health, work and other areas, using the dated history every module stores.
- [x] **Workout templates in Lift Log.** Decided: yes. Now in the Lift Log and Calendar prompts.
