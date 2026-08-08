# Quarry Sports Bar — Play Engine Test Runbook

Three layers. Run them in order. Layer 3 is the one that proves the whole
machine before real money enters the room.

## Layer 1 — Front-end flow (no setup)
Double-click `site/play.html`. It auto-runs demo mode from disk.
Enter any code like `QRY-1234` → pick all 11 sample fixtures → choose 7
numbers → Review & submit → confirmation slip appears. ✅ Player experience works.

## Layer 2 — Engine logic (needs Node.js on your Mac)
```
cd ~/Documents/"Quarry Sports Bar"/quarry-website-complete
node tests/run-tests.js
```
Expect: **18 passed, 0 failed** — draw fairness, tamper rejection, scoring,
ties, cut-offs, minimum-entries maths.

## Layer 3 — Full dress rehearsal (after deploy)
Prerequisites: schema run in Supabase, all 4 env vars in Netlify, site deployed.
No real Saturday needed — you control the card and set results by hand.
Takes ~20 minutes. Use your phone as the "customer" and your laptop as "staff".
**Run the rehearsal before 6:30pm** — number entries close at 6:30pm sharp
(server-enforced), so an evening test will be refused. To test later, nudge
the week's `numbers_close`/`draw_time` forward in Supabase → weeks table.

1. **Staff (laptop):** open `yoursite.com/admin.html` → enter the admin key → Unlock.
2. **Create the week:** pick any date a few days ahead, first kickoff a time
   at least an hour from now. Paste 3 test fixtures, e.g.:
   ```
   Premier League | Test FC | Trial United | 15:00
   Premier League | Quarry XI | Imperial FC | 15:00
   La Liga | Rehearsal CF | Practice FC | 16:00
   ```
   (No external IDs → no football API involved; results will be set manually.)
   Click **Create week**, then **Open entries**.
3. **Issue codes:** issue 3 codes. Note them.
4. **Customer (phone):** open `yoursite.com/play` — the 3 fixtures should show.
   Enter code #1 + your real phone number + first name → make picks + tie-break
   + 7 numbers → submit → you should get a **server reference** on the slip.
5. **Prove one-code-one-entry:** try the SAME code again → must be refused
   ("already submitted picks"). Try a made-up code → "code not found".
6. **Lost receipt:** admin §4 → look up your phone number → your entry appears.
7. **Set results:** admin §5 → set each fixture (get fixture IDs from
   "Load current week") — give yourself some right and some wrong.
8. **Leaderboard:** refresh `/play` — live standings should show your entries
   with correct scores. Enter with codes #2/#3 first if you want a real table.
9. **The draw:** admin §6 → **Commit draw** (copy the fingerprint it returns)
   → then **Reveal draw** → 7 numbers + the seed appear.
10. **Verify the draw publicly:** on `/winners`, "Check a draw yourself" →
    paste fingerprint, seed, and the 7 numbers → must say **✓ VERIFIED**.
    Then change one number and check again → must say **✗ FAILED**.
11. **Prove the draw can't be re-rolled:** press Reveal again → must be
    refused ("already_drawn").
12. **Record a winner:** admin §7 → record yourself → check it saved.
13. **Reset for real play:** in Supabase → Table editor, delete the test rows
    from `entries`, `codes`, `winners`, `fixtures`, `weeks` (in that order),
    or just leave them — test weeks are identifiable by their fake team names —
    and create the real week fresh on launch Thursday.

### Pass criteria
Every step behaves as described, and step 10 verifies ✓ then fails ✗ after
tampering. If any step fails, note which number and what happened — that's
exactly what's needed to fix it fast.

### Before the first paid Saturday
Repeat Layer 3 once **with bar staff driving the admin**, on the actual bar
wifi and the actual big screen, including printing codes on real receipts.
The rehearsal is for the humans as much as the software.
