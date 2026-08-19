# Quarry Admin — Simple Operating Guide

*For Tolu and the bar manager. Everything happens at **quarrysportsbar.com/admin.html** with the admin key. This is the short version — the full manual with every edge case is OPERATIONS.md.*

---

## The one thing to understand first

**The website always shows the newest match day you've created. Old matches never
disappear on their own** — they stay on the Play page until you create the next
match day, which replaces them instantly. This is by design, not a fault.

So yes — you load new matches manually, once a week, and it takes about 5 minutes.

**The football API does not load matches for you.** It does one job only: after a
match you entered has finished, it fills in the result (Home/Draw/Away)
automatically so the leaderboard scores itself. Fixtures in, results out.

---

## Thursday or Friday — set up the match day (5 minutes)

1. Open **quarrysportsbar.com/admin.html** → type the admin key → **Unlock**.
   You must see **✓ key verified** before anything else will work.
2. **§2 Create the match day** — pick the date (Saturday or midweek, any day works)
   and the first kickoff time, then paste the fixtures, one per line:

   ```
   Premier League | Arsenal | Everton | 13:30 | 537214
   Premier League | Chelsea | Wolves  | 16:00 | 537215
   ```

   The last number is the football-data **match ID** — optional, but it's what makes
   results automatic. No ID = you'll type that result in by hand on the night.
   (How to find IDs is at the bottom of this guide.)
3. Click **Create week** — the site switches to the new match day immediately, in
   teaser mode. Click **Open entries** when you're ready to accept plays
   (Friday morning is a good habit).
4. **§3 Issue codes** — e.g. 60. Print the list; waiters hand one code per
   customer once they've spent ₦5,000. Codes work for this match day only.

Cut-offs are set for you: numbers close 6:30pm, draw 7:00pm, minimum entries 25.

## Match day — run the night

| Time | Do this |
|---|---|
| All day | Waiters give codes for ₦5,000+ spend. Customers play at **/play**. Picks close by themselves at first kickoff; lucky numbers at 6:30pm. |
| ~6:15pm | Put **quarrysportsbar.com/draw.html** on the big screen — it shows the countdown and plays the show by itself. |
| 6:30pm | **§6 → Commit draw.** This seals the result and publishes the fingerprint. After this, nothing and nobody can change the outcome. |
| 7:00pm | **§6 → Reveal draw.** The bingo show plays on the big screen; the output box names the winner(s) and the winning ball. |
| After the draw | **§7 Record winner** — kind **Bingo**, amount **20000**, tick consent if they're happy to be photographed. Pay at the bar. |
| As matches finish | Results appear on the leaderboard by themselves within ~2 minutes of full time. If one hasn't after 10 minutes, set it by hand in **§5** (get fixture IDs from **§1 Load current week**). Postponed match → **Void**. |
| After the last final whistle | The leaderboard settles itself — highest score wins. **§7 Record winner** — kind **Match Picks**, amount **50000**. Pay the same night. |

## When something goes wrong

- **✗ key rejected** — wrong admin key, or ADMIN_KEY missing in Netlify. Nothing else will work until Unlock shows ✓.
- **"Code not found" at the till** — that code was never issued for *this* match day. Check §1, reissue in §3.
- **Customer lost their slip** — §4, look them up by phone number.
- **A result is wrong or missing** — §5 overrides anything, any time before winners are recorded.
- **Never re-run a draw.** Commit and Reveal each work exactly once per match day — the system refuses a second attempt, on purpose. If something looks wrong, stop and check before recording a winner.

---

## The football API — how to test it (one-time, ~10 minutes)

The site uses football-data.org. Your key lives in Netlify as `FOOTBALL_DATA_KEY`.

**Step 1 — check your key works.** In Terminal on your Mac (put your real key in):

```
curl -s -H "X-Auth-Token: YOUR_KEY" \
  "https://api.football-data.org/v4/competitions/PL/matches?dateFrom=2026-08-22&dateTo=2026-08-23"
```

A healthy reply is a wall of JSON with `"matches": [...]`. If you get
`403` or an error message instead, the key is wrong or expired.

**Step 2 — that same reply is where match IDs come from.** Each match in the list
has an `"id"` (e.g. `537214`) plus the home and away team. Those IDs are what you
paste as the last column in §2. Change `PL` for other leagues:
`PL` Premier League · `ELC` Championship · `CL` Champions League ·
`PD` La Liga · `SA` Serie A · `BL1` Bundesliga · `FL1` Ligue 1.
(The free plan covers all of these. Limit: 10 requests a minute — fine for us.)

**Step 3 — prove the whole loop, end to end.** Create a throwaway match day in §2
using the ID of a match that has **already finished** (yesterday's game). Open
entries. Within ~2 minutes the result appears on the fixture by itself — that's the
sync working. Then clean up the test week in Supabase, deleting in this exact
order: winners → entries → codes → fixtures → weeks.

**Good to know:** the sync runs every 2 minutes between 12:00pm and 11:00pm
Nigeria time, and only while a match day is open or live. A match with no
external ID is simply skipped — §5 is your fallback, and the night works fine
either way.
