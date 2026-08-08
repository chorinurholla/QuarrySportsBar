# Quarry Sports Bar — Deployment Guide (complete project)

This folder is the whole product: static site (`site/`), serverless backend
(`netlify/functions/` + `lib/`), database schema (`supabase/`), staff admin
(`site/admin.html`), and tests (`tests/`). Verified: 18/18 unit tests pass;
draw derivation matches the public verifier on the Winners page.

## Launch checklist — in order

### A. Accounts (Tolu owns all of them)
1. **Supabase** (supabase.com, free tier) — create a project, then open the SQL
   editor and run the whole of `supabase/schema.sql` once.
2. **Netlify** (netlify.com, free tier) — create a site from this folder
   (drag-and-drop the folder, or push to GitHub and connect — GitHub route
   recommended so future updates are one push).
3. **football-data.org** — free account → API token (covers EPL, Bundesliga, La Liga).
4. **Domain** — buy `quarrysportsbar.com` (+ `.com.ng` if desired); point it at
   Netlify per their DNS instructions.

### B. Environment variables (Netlify → Site settings → Environment)
| Name | Value |
|---|---|
| `SUPABASE_URL` | from Supabase → Project settings → API |
| `SUPABASE_SERVICE_KEY` | the **service_role** key (never the anon key; never in front-end code) |
| `ADMIN_KEY` | a long random passphrase — Tolu + bar manager only |
| `FOOTBALL_DATA_KEY` | from football-data.org |

Redeploy after setting these.

### C. Switch the site live
1. `site/config.js` → change `window.QUARRY_API = null` to `'/api'`.
2. Remove the demo banner line at the top of `site/play.html`.
3. Fill every remaining `[to be confirmed]` (address, hours, WhatsApp links,
   tier values, drink offer) and drop in the real photography.
4. **Do not launch before the lawyer signs off** the rules/terms copy (all
   flagged in-page) — this is the one hard gate.

## Weekly operation (staff, ~10 minutes total)

- **Thursday:** open `/admin.html` → unlock → "Create the week" (paste the
  fixtures, one per line — include football-data match IDs for auto-results) →
  "Open entries". Codes: "Issue codes" → print the list for the till.
- **Saturday:** nothing to do until evening — results and the live/leaderboard
  state update automatically every 2 minutes.
- **9:00pm:** admin → **Commit draw** (publishes the fingerprint).
- **9:30pm:** big screen on the Play page → admin → **Reveal draw**.
- **After the last match:** admin → record winners (photo consent checkbox),
  pay the same night.
- **Fallback:** if the results feed fails, set results manually in admin §5.
  If the site is down before cut-off, paper entries at the bar (per Rules).

## What each piece is

| Path | Role |
|---|---|
| `lib/rules.js` | All competition logic (validation, scoring, ties, pool, tiers) — unit-tested |
| `lib/draw.js` | Commit–reveal draw engine — unit-tested |
| `netlify/functions/week.js` | Public: current card, cut-offs, draw status |
| `netlify/functions/redeem.js` | Public: code pre-check (UX only) |
| `netlify/functions/submit.js` | Public: authoritative entry — server-clock cut-offs, atomic write |
| `netlify/functions/leaderboard.js` | Public: masked live standings |
| `netlify/functions/results-sync.js` | Scheduled: football-data results → fixtures (Saturdays, every 2 min) |
| `netlify/functions/admin.js` | Staff ops behind `X-Admin-Key` |
| `supabase/schema.sql` | Tables, RLS (phones never public), atomic `submit_entry()`, leaderboard view |
| `site/admin.html` | Staff console (unlinked, noindex) |

## Security notes
- Phone numbers are readable only by the service role — the public API never
  returns them; the leaderboard shows "FirstName ··ref" only.
- The service key and admin key live only in Netlify env vars.
- The draw cannot be re-rolled: commit is refused twice, reveal is refused
  before commit and after first reveal (enforced server-side).
- Rate-limiting: enable Netlify's basic protections; Cloudflare in front is a
  good upgrade if code-guessing traffic ever appears.

## Still open before real money
Lawyer sign-off (gate) · venue content + photos · tier values + minimum-entries
final numbers · domain + accounts · a full dress rehearsal Saturday with staff
(test codes, commit, reveal, record winners) before the first paid week.
