# Website Deep Audit — Hardcoding & Blindspots
**Date:** 10 August 2026 · All "FIXED" items implemented, browser-verified against a mocked live backend, and committed.

## Part 1 — Hardcoded things that now follow the match day

| Item | Was | Now |
|---|---|---|
| Fixture-list day label ("Saturday" top-right) | Hardcoded | Derived from the week's real date — shows Wednesday for a Wednesday card |
| Play status bar (state + "Closes Saturday 13:30 · numbers…") | Static sample text, never updated | Driven by the server: real state (Entries open / Matches live / Results are in), real day, real cut-off times |
| Draw panel title & notes ("7:00pm — lights down") | Hardcoded times | Uses the week's actual `draw_time` / `numbers_close` |
| Play page browser title | "This Saturday's card" | "Match day card" |
| Admin labels ("Saturday date", "this Saturday only") | Saturday-locked wording | Day-agnostic (done earlier today) |
| Results polling schedule | Saturdays only | Every day (function self-skips when no game is open) |

**Deliberately left as "Saturday" (marketing copy, not logic):** the homepage hero and meta ("Saturday football…"), "Enter this Saturday" CTAs, the rules walkthrough narrative, the Visit page "Saturdays at Quarry" timeline, and footer links. Saturday is the flagship product and this language sells it; a midweek special works fine alongside it. If midweek ever becomes permanent, ask for the copy sweep to "every match day".

**Constants to keep in sync by hand:** the prose mentions of 6:30pm/7:00pm and prize values across Rules/Visit/Home describe the *standard* offer. The engine reads per-week values from the database, so if you ever change the standard times or prizes, the copy needs a matching sweep (this is noted in OPERATIONS.md §10).

## Part 2 — Blindspots found and FIXED

These were real gaps: the backend supported the feature, but the public site never used it.

1. **The live leaderboard was never wired up.** The `/api/leaderboard` endpoint existed since Phase 2, but the Play page only ever showed hardcoded sample names. Now: in live mode the board shows real standings, refreshes every 90 seconds, and shows "No entries on the board yet — be the first" when empty. SAMPLE badge becomes LIVE.
2. **Drawn numbers never appeared on the site.** The draw panel showed sample balls forever. Now it shows the real 7 numbers the moment the reveal happens, and before that shows the correct sealed/committed status with real times.
3. **The draw fingerprint was published nowhere.** The whole provably-fair story depended on customers seeing the commitment before the draw — but no page ever displayed it. Now the Winners page shows a "This match day's draw" card: the fingerprint as soon as staff commit, then the numbers + seed after reveal — **and the verify-it-yourself checker is pre-filled automatically**, so verification is one button press.
4. **The Winners archive was permanently a sample.** Winners recorded in admin went into the database and never came out. New public endpoint (`/api/winners`) + the Winners page now renders the real weekly record — winner names, amounts, drawn numbers, tier winners — and computes the "₦X paid out across N match days" running total from real data. The trust engine is now actually running.
5. **"Your picks save as you go" was not true.** A customer who refreshed mid-entry (or whose phone reloaded the tab at a busy bar) lost everything. Now drafts save locally on every tap and restore automatically when they re-enter their code — verified across a real page reload. Cleared on successful submission.
6. **The status bar told everyone it was Saturday 13:30 forever.** See Part 1 — now live data.

## Part 3 — Backlog (not built; recommended order)

1. **Entries counter** on the Play page ("42 entries so far") — social proof + pool transparency for the minimum-entries rule. Small build.
2. **Winner photo upload** — the database has a `photo_url` field and consent flag, but admin has no upload flow (needs Supabase Storage). Photos currently live on WhatsApp; fine for launch, build within the first month.
3. **Custom 404 page** routing back to the current card. Trivial; cosmetic.
4. **Analytics** — enable Netlify Analytics or add Cloudflare's free web analytics one-liner, so entry-funnel numbers exist from week 1.
5. **Self-hosted Outfit font** — pre-launch performance task from the build notes; still open.
6. **WhatsApp Business API** auto-confirmations and result pushes — Phase 3, once volume justifies the cost. Current wa.me flow is the right start.
7. **Rate-limiting hardening** (Cloudflare in front) if code-guessing traffic ever shows up in logs.

## Deploy note
This audit adds one new serverless function (`netlify/functions/winners.js`). It goes live with the normal push — no new environment variables, no schema changes.
