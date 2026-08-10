# Quarry Sports Bar — Competition Operations Manual
**The living taxonomy: how to run the engine independently.**
Version 1.0 · August 2026 · Keep this updated — when a rule or routine changes, change it here the same day.

Who this is for: Tolu and the bar manager. No technical knowledge assumed beyond using a browser.
What you operate: one admin page — `quarrysportsbar.com/admin.html` — plus, rarely, the Supabase dashboard.

---

## 1. The mental model — a week's life

Every competition is a **week record** that moves through states. Everything you do in admin is moving the week along this line:

```
CREATE (teaser) → OPEN (entries) → LIVE (matches playing) → DRAW (commit → reveal) → SETTLE (winners paid & recorded)
```

The website always shows the **newest-dated** week. Customers can only enter while the week is OPEN/LIVE and before the cut-offs. The server clock enforces every deadline — nothing you or staff do can accept a late entry, which protects you from arguments.

**The standing timetable (any match day, not just Saturdays):**

| Time | What happens | Who acts |
|---|---|---|
| Thursday (or 2 days before) | Card published, entries open, codes issued | Manager, 10 min |
| Match day, from opening | Waiters hand out codes with ₦5,000+ spends | Waiters |
| First kickoff | Match picks close (automatic) | Nobody |
| 6:30pm | Numbers close (automatic) · **Commit draw** | Manager, 1 click |
| 7:00pm | **Reveal draw** on the big screen | Manager, 1 click |
| After last match | Results land → winner known → pay & record | Manager, 10 min |

---

## 2. Access & roles

- **The admin key** is the only credential. Two people hold it: Tolu and the bar manager. It is typed into the admin page each session ("Unlock" — the badge must say ✓ *key verified*). Never write it on anything that stays at the bar; never send it in a group chat.
- If the key leaks: change the `ADMIN_KEY` value in Netlify → Site configuration → Environment variables, then Deploys → Trigger deploy. Old key dead in ~2 minutes.
- **Waiters need no access.** Their whole job is: hand out codes from the printed list, help customers through the phone flow (see the waiter card).
- Account logins (Netlify, Supabase, football-data, domain) belong to Tolu only.

---

## 3. The weekly cycle, step by step

### 3.1 Thursday — publish the card (≈10 minutes)

1. Open `quarrysportsbar.com/admin.html` → enter admin key → **Unlock** → wait for ✓.
2. **Section 2 — Create the week.**
   - Saturday date: the match day (any day of the week works — see §4).
   - First kickoff: the earliest kickoff on your card (e.g. 13:30).
   - Fixtures, one per line, exactly this shape:
     `Premier League | Arsenal | Everton | 13:30 | 497555`
     The last number (football-data match ID) is **optional**:
     - **With ID** → results arrive automatically every 2 minutes. Best.
     - **Without ID** → you enter results yourself in Section 5 after each final whistle (30 seconds per match). Perfectly fine.
   - Click **Create week (as teaser)** — check the output box says ok.
3. Click **Open entries.** The card is now live on the website.
4. **Section 3 — Issue codes.** Enter how many you expect to sell (start with 60; you can issue more any time on the day). Print the list from the output box; cut into slips or keep at the till. *Codes are valid for this week only — never reuse a previous week's list.*
5. Post the card on WhatsApp Status: "This Saturday's card is live — spend ₦5,000, play free, win ₦50,000."

### 3.2 Match day, daytime — selling entries (waiters)

- Customer's bill crosses ₦5,000 → waiter offers the pitch (waiter card), hands a code from the list, helps them play at `quarrysportsbar.com/play`.
- Golden rules staff must know: **one code per customer per day** · codes are **today only** · picks close at first kickoff, **numbers close 6:30pm** — after that a paying customer can no longer enter (sell tomorrow's experience instead: "come earlier next week").
- Ran out of codes? Admin Section 3, issue another batch — new codes work instantly.
- Customer says code doesn't work → check the digits first; if genuinely broken, give them a fresh code and tell Tolu the bad one (Section 3's **void** exists for cancelling a code that shouldn't be used).

### 3.3 Match day, afternoon — nothing

With match IDs supplied, scores and the live leaderboard update themselves every 2 minutes. Without IDs, enter each result in **Section 5** as matches finish (fixture IDs are shown by **Section 1 → Load current week**). Put the Play page on one of the big screens — the leaderboard is theatre.

### 3.4 — 6:30pm sharp: COMMIT the draw

Admin **Section 6 → Commit draw.** One click. This publicly seals the draw result (its "fingerprint" appears on the site) *before* anyone — including you — knows the numbers. This is what makes the draw provably fair. **Do not skip and do not do it early** (numbers must be closed) — the button refuses to run twice.

### 3.5 — 7:00pm: REVEAL the draw (the show)

1. Put the website's Play page on the big screen.
2. MC counts down, lights down.
3. Admin **Section 6 → Reveal draw.** The 7 numbers appear on the site (and the screen) instantly, with the seed anyone can verify on the Winners page.
4. The output box also lists every tier winner (match 5/6/7) by name and reference — read them out.
- Reveal is refused before commit, and refused a second time. The draw can never be re-rolled — if someone asks, that's the answer: *the machine won't allow it.*

### 3.6 After the last whistle — settle (≈10 minutes)

1. Confirm all fixtures have results (Section 1 → Load current week; fill any gaps via Section 5).
2. The leaderboard's top row is your winner. Ties after the total-goals tie-break share equally — the published rule decides, not you.
3. **Check the pool:** 25+ entries → full ₦50,000. Fewer → ₦2,000 × entries (e.g. 18 entries = ₦36,000). This is printed in the rules; pay exactly that.
4. Pay the winner: ₦20,000 cash + ₦30,000 bar & kitchen credit (or the reduced pool split in the same 40/60 spirit). Photograph the moment — ask consent for name/photo first (they can decline the photo and still be paid).
5. **Section 7 — Record winner** for the picks winner and each numbers-tier winner (match 5 = ₦5,000 credit, match 6 = ₦10,000 credit, match 7 = ₦20,000 credit).
6. **Section 1 → set state** to `settled` (or leave — creating next week's card supersedes it either way).
7. Post the winner photo + results on WhatsApp Status. This is the marketing engine — never skip it.
8. Unclaimed prizes: winner has 14 days, with code + ID. Credit valid 30 days, dine-in only.

---

## 4. Midweek games (Wednesday etc.)

Identical routine — the engine doesn't care what day it is. Only differences:
- Create the midweek card **after** the previous weekend is settled (the site shows the newest-dated week).
- Results polling runs daily, so match IDs still auto-score; manual entry also fine.
- The site's copy says "Saturday" — fine for one-off specials (promote in-venue/WhatsApp); if midweek becomes permanent, have the site copy updated to match.

---

## 5. The admin panel — every section explained

| § | Name | What it does | When |
|---|---|---|---|
| 0 | Unlock | Verifies your admin key with the server (✓/✗) | Every session, first |
| 1 | This week | Shows the current week: state, cut-offs, fixtures **with their IDs**, draw status | Any time you're unsure |
| 2 | Create the week / Open entries | Makes the new card; opens it to entries | Thursday |
| 3 | Issue codes / Void code | Prints entry codes; cancels a specific code | Thursday + match day |
| 4 | Lost receipt lookup | Finds a customer's entry by phone number | Disputes, lost slips |
| 5 | Results fallback | Sets a match result by hand (Home/Draw/Away/**Void**) | No-ID fixtures, feed failure, postponed match |
| 6 | The draw | Commit (6:30) then Reveal (7:00) | Match day evening |
| 7 | Record winners | Writes the public record (name, amount, consent) | After settling |

---

## 6. When things go wrong (edge cases)

**A match is postponed/abandoned** → Section 5, set it to **Void**. It's excluded from everyone's score; the week continues on the remaining fixtures. (Published rule — no discretion needed.)
**Fewer than 8 fixtures finish** → the whole week is void; codes roll to the next week. Announce it, keep the code list.
**Results feed stops** → enter results manually in Section 5. The competition never depends on the feed.
**The website goes down before cut-off** → paper entries at the bar (photocopy a simple grid), same deadlines; enter nothing into the system — score paper by hand that week. (Published rule.)
**You forgot the 6:30 commit** → do it as soon as you notice, *before* reveal. Commit after 6:30 is still fair (entries were already closed by the server); just never reveal without a commit — the system won't let you anyway.
**Someone claims they entered but nothing is found** → Section 4, look up by phone. The system's answer is final: no entry, no prize. Their slip screenshot shows a reference — if it's real, lookup finds it.
**Two customers used the same code** → impossible; the second submission is rejected by the database. The one that got in first owns it.
**A customer wants to change picks** → no edits after submission, for anyone. Published rule.
**Angry disputes** → same night or next day, with the code. "Management decision is final" is in the rules — but the system's records (Section 4) settle nearly everything factually.
**The site shows an old card / "Load current week" returns empty fixtures** → the website always shows the **newest-dated** week that exists. A leftover later-dated week (e.g. an old Saturday test) beats a new earlier-dated card, even if its fixtures were deleted. Fix: delete the stale week completely (SQL editor, in order: winners → entries → codes → fixtures → weeks, filtered to that week — or all rows if it's all test data), then recreate the real card **through the admin page**. *Lesson learned 10 Aug 2026.*
**Never hand-create weeks or fixtures in Supabase** → the admin's Create-the-week does invisible work: binds fixtures to the right week, sets cut-offs in Nigerian time (hand-typed timestamps default to UTC — one hour off), and leaves the draw unspoiled. Supabase is for **inspecting and deleting only** (§7).

---

## 7. Rare chores (Supabase — Tolu only)

Log in at supabase.com → your project → **Table Editor**.
- **See all entries for a week:** `entries` table, filter by week.
- **Change a week's times** (e.g. test in the evening): `weeks` table → edit `numbers_close` / `draw_time`.
- **Clear test data:** delete rows in this order: `winners` → `entries` → `codes` → `fixtures` → `weeks`.
- **Monthly backup:** Table Editor → each table → export CSV → keep in Google Drive.
- Never edit `draw_commit` / `draw_seed` / `drawn_numbers` by hand — that's the fairness machinery.

---

## 8. Troubleshooting quick table

| You see | It means | Do |
|---|---|---|
| ✗ key rejected (admin) | Wrong/changed admin key, or env var missing | Re-type; check Netlify env var; redeploy |
| "No card is open right now" (Play) | No open week, or week is settled | Create/open the week in §2 |
| "We can't reach the competition server" | Internet or Netlify problem | Check connection; check Netlify status; paper fallback if near cut-off |
| "Code not found" | Made-up or mistyped code | Check digits; issue a fresh one if needed |
| "Already submitted picks" | Code was used | Correct behaviour — one entry per code |
| "Entries are closed" | Server clock passed the cut-off | Correct behaviour — no exceptions possible |
| already_committed / already_drawn | Draw button pressed twice | Correct behaviour — nothing to fix |

---

## 9. Printable match-day checklist

```
BEFORE (Thursday):  □ Unlock ✓   □ Create week   □ Open entries   □ Issue + print codes   □ WhatsApp status
MATCH DAY:          □ Codes at till + waiter cards out   □ Play page on a big screen
                    □ Results flowing (or entering via §5)
6:30pm:             □ COMMIT draw
7:00pm:             □ REVEAL draw on big screen   □ Announce tier winners
AFTER LAST MATCH:   □ All results in   □ Check pool (25+? else ₦2,000×entries)
                    □ Pay winner (₦20k cash + ₦30k credit)   □ Photo + consent
                    □ Record winners (§7)   □ WhatsApp winner post
```

---

## 10. Keeping this manual alive

This document lives in the project folder (`OPERATIONS.md`) and in the Claude project. When anything changes — prize values, times, a new edge case you hit, a better routine — update it the same day, commit, push. If a Saturday teaches you something the manual didn't cover, that lesson belongs in §6.

Current fixed values (change here if they change in the rules): entry = ₦5,000 minimum spend · pool = ₦50,000 (₦20k cash/₦30k credit) · minimum entries 25, fallback ₦2,000×entries · tiers ₦5k/₦10k/₦20k credit · numbers close 6:30pm · draw 7:00pm · claim window 14 days · credit validity 30 days.
