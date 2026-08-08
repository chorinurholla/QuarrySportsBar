# Quarry Sports Bar — Website (Phase 1)

Production-ready static front-end for the Quarry Sports Bar Saturday competition,
built to the approved "Matchday Print" design system.

## What's in the box

| File | Purpose |
|---|---|
| `index.html` | Home — value proposition, how it works, both games, visit teaser |
| `play.html` | Play hub — code redemption → Match Picks → 7 Lucky Numbers → confirmation slip, plus a sample of the live scoreboard and draw night. **Runs in demo mode** (clearly bannered) until the Phase 2 backend is attached |
| `winners.html` | Results & Winners — pre-launch state, sample weekly-record layout, fair-draw explanation |
| `rules.html` | Plain-English rules, FAQ, terms placeholder (pending legal review) |
| `visit.html` | Location, Saturday timeline, contact — awaiting venue details |
| `styles.css` | The complete design system (all tokens per the design-system doc) |
| `app.js` | Nav, demo entry flow. Backend attachment points marked `// [PHASE2]` |
| `assets/` | Logo lockups extracted from the brand PDF, favicons |

## Code status labels

- **Production-ready:** all HTML/CSS, nav behaviour, page structure, accessibility scaffolding.
- **Demo mode (prototype):** the Play entry flow — validation is client-side and entries are not stored. Every server integration point is marked `[PHASE2]` in `app.js`.
- **Placeholders:** all `[to be confirmed]` content (address, hours, WhatsApp, tier values, drink offer, legal terms) and photo frames await Tolu's inputs — deliberately visible so nothing ships forgotten.

## Deploy (Phase 1)

Any static host works. Recommended: Cloudflare Pages or Netlify (free).

1. Create an account (owned by Tolu, not a contractor).
2. Drag-and-drop this folder (or connect a Git repo) — no build step required.
3. Point the domain (`quarrysportsbar.com` / `.com.ng`) at the host per its DNS instructions.

Before public launch: replace the Google Fonts `<link>` with self-hosted Outfit
(weights 400/500/600/700, subset), add real photography, fill every
`[to be confirmed]`, and remove the demo banner only when Phase 2 is live.

## Phase 2 (per the technical architecture doc)

Supabase (codes/entries/results) + serverless functions (code validation,
cut-off-enforced submission, scoring, commit–reveal draw) + football-data.org
fixtures/results + staff admin. See `claude/quarry-sports-bar-tech-architecture.md`
in the project.
