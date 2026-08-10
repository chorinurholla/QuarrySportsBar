/**
 * Pure competition logic — no I/O. Unit-tested in tests/run-tests.js.
 * These functions are the single source of truth for validation and scoring;
 * serverless functions stay thin around them.
 */
'use strict';

const CODE_RE = /^QRY-?\d{4}$/i;

function normalizeCode(raw) {
  const v = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
  if (!/^QRY\d{4}$/.test(v)) return null;
  return 'QRY-' + v.slice(3);
}

function normalizePhone(raw) {
  const v = String(raw || '').replace(/[\s()-]/g, '');
  return /^(\+?234|0)\d{10}$|^(\+?234|0)\d{9,10}$/.test(v) ? v : null;
}

/** Validate a submission payload against week timing. Returns {ok} or {ok:false, error}. */
function validateSubmission({ now, week, fixtures, picks, tiebreak, numbers }) {
  const t = new Date(now).getTime();
  const picksCutoff = new Date(week.picks_cutoff).getTime();
  const numbersClose = new Date(week.numbers_close).getTime();

  if (week.state !== 'open' && week.state !== 'live') {
    return { ok: false, error: 'entries_closed', message: 'This week is not open for entries.' };
  }
  if (t >= numbersClose) {
    return { ok: false, error: 'entries_closed', message: 'Entries are closed for this week.' };
  }

  // Numbers: always required — 7 distinct integers 0..49.
  if (!Array.isArray(numbers) || numbers.length !== 7) {
    return { ok: false, error: 'numbers_invalid', message: 'Choose exactly 7 numbers.' };
  }
  const clean = numbers.map(Number);
  if (clean.some(n => !Number.isInteger(n) || n < 0 || n > 49) || new Set(clean).size !== 7) {
    return { ok: false, error: 'numbers_invalid', message: 'Numbers must be 7 different values from 0 to 49.' };
  }

  // Picks: required before first kickoff; forbidden after (numbers-only late entry).
  const picksAllowed = t < picksCutoff;
  if (picksAllowed) {
    if (!picks || typeof picks !== 'object') {
      return { ok: false, error: 'picks_missing', message: 'Pick every match on the card.' };
    }
    const missing = fixtures.filter(f => !['H', 'D', 'A'].includes(picks[String(f.id)]));
    if (missing.length) {
      return {
        ok: false, error: 'picks_incomplete',
        message: 'Pick every match on the card.',
        missing: missing.map(f => f.id)
      };
    }
    if (tiebreak == null || !Number.isInteger(Number(tiebreak)) || tiebreak < 0 || tiebreak > 99) {
      return { ok: false, error: 'tiebreak_invalid', message: 'Add your total-goals tie-break (0–99).' };
    }
  } else if (picks && Object.keys(picks).length) {
    return {
      ok: false, error: 'picks_late',
      message: 'The first match has kicked off — match picks are closed, but your 7 numbers can still go in until 9:00pm.'
    };
  }

  return { ok: true, picksIncluded: picksAllowed, numbers: clean };
}

/** Score one entry's picks against fixture results. Void ('V') fixtures are excluded. */
function scorePicks(picks, fixtures) {
  if (!picks) return null; // numbers-only entry
  let correct = 0, decided = 0;
  for (const f of fixtures) {
    if (f.result === 'V' || !f.result) continue;
    decided++;
    if (picks[String(f.id)] === f.result) correct++;
  }
  return { correct, decided };
}

/** Rank entries: most correct, then closest tie-break to actual total goals, ties share. */
function rankEntries(entries, fixtures, totalGoals) {
  const scored = entries
    .filter(e => e.picks)
    .map(e => ({ ...e, score: scorePicks(e.picks, fixtures).correct }))
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { table: [], winners: [] };
  const top = scored[0].score;
  let leaders = scored.filter(e => e.score === top);
  if (leaders.length > 1 && totalGoals != null) {
    const best = Math.min(...leaders.map(e => Math.abs((e.tiebreak ?? 999) - totalGoals)));
    leaders = leaders.filter(e => Math.abs((e.tiebreak ?? 999) - totalGoals) === best);
  }
  return { table: scored, winners: leaders };
}

/** Prize pool given entry count (minimum-entries clause). */
function computePool(week, entryCount, entryFee = 5000) {
  if (entryCount >= week.min_entries) return { pool: week.pool_full, reduced: false };
  const pool = Math.floor((entryCount * entryFee * week.fallback_pct) / 100);
  return { pool, reduced: true };
}

/** BINGO: the 1-based ball index at which an entry completes all 7 numbers. */
function completionBall(entryNumbers, sequence) {
  let last = -1;
  for (const n of entryNumbers) {
    const idx = sequence.indexOf(n);
    if (idx === -1) return null; // sequence must contain 0-49; null = invalid
    if (idx > last) last = idx;
  }
  return last + 1;
}

/** BINGO winners: entries that complete earliest; ties on the same ball share. */
function bingoWinners(entries, sequence) {
  let best = Infinity;
  let winners = [];
  for (const e of entries) {
    const b = completionBall(e.numbers, sequence);
    if (b == null) continue;
    if (b < best) { best = b; winners = [e]; }
    else if (b === best) winners.push(e);
  }
  return { winningBall: Number.isFinite(best) ? best : null, winners };
}

module.exports = {
  CODE_RE, normalizeCode, normalizePhone,
  validateSubmission, scorePicks, rankEntries, computePool,
  completionBall, bingoWinners
};
