'use strict';
/* Unit tests for the pure competition logic. Run: node tests/run-tests.js */
const assert = require('assert');
const { makeCommit, deriveNumbers, verify, sha256Hex } = require('../lib/draw');
const { normalizeCode, validateSubmission, scorePicks, rankEntries, computePool, numberTier } = require('../lib/rules');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('draw.js');
test('commit matches seed hash', () => {
  const { seed, commit } = makeCommit();
  assert.strictEqual(sha256Hex(seed), commit);
});
test('derivation is deterministic', () => {
  const seed = 'ab'.repeat(32);
  assert.deepStrictEqual(deriveNumbers(seed), deriveNumbers(seed));
});
test('derives 7 distinct numbers in 0–49', () => {
  for (let i = 0; i < 200; i++) {
    const nums = deriveNumbers(makeCommit().seed);
    assert.strictEqual(nums.length, 7);
    assert.strictEqual(new Set(nums).size, 7);
    nums.forEach(n => assert.ok(n >= 0 && n <= 49, 'out of range: ' + n));
  }
});
test('verify accepts honest draw', () => {
  const { seed, commit } = makeCommit();
  assert.strictEqual(verify(seed, commit, deriveNumbers(seed)).ok, true);
});
test('verify rejects wrong seed', () => {
  const { commit } = makeCommit();
  const other = makeCommit().seed;
  assert.strictEqual(verify(other, commit, deriveNumbers(other)).ok, false);
});
test('verify rejects tampered numbers', () => {
  const { seed, commit } = makeCommit();
  const nums = deriveNumbers(seed).slice();
  nums[6] = (nums[6] + 1) % 50;
  assert.strictEqual(verify(seed, commit, nums).ok, false);
});

console.log('rules.js — codes');
test('normalizes code formats', () => {
  assert.strictEqual(normalizeCode('qry 1234'), 'QRY-1234');
  assert.strictEqual(normalizeCode('QRY-0007'), 'QRY-0007');
  assert.strictEqual(normalizeCode('qry1234'), 'QRY-1234');
  assert.strictEqual(normalizeCode('ABC-1234'), null);
  assert.strictEqual(normalizeCode('QRY-123'), null);
});

const week = {
  state: 'open',
  picks_cutoff: '2026-08-15T12:30:00Z',   // 13:30 WAT
  numbers_close: '2026-08-15T20:00:00Z',  // 21:00 WAT
  min_entries: 25, pool_full: 100000, fallback_pct: 80
};
const fixtures = [
  { id: 10, result: 'H' }, { id: 11, result: 'D' }, { id: 12, result: 'A' },
  { id: 13, result: 'V' }, { id: 14, result: null }
];
const goodPicks = { '10': 'H', '11': 'H', '12': 'A', '13': 'D', '14': 'A' };
const nums = [1, 2, 3, 4, 5, 6, 7];

console.log('rules.js — submission timing');
test('accepts full entry before kickoff', () => {
  const r = validateSubmission({ now: '2026-08-15T10:00:00Z', week, fixtures, picks: goodPicks, tiebreak: 27, numbers: nums });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.picksIncluded, true);
});
test('rejects incomplete picks with named fixtures', () => {
  const r = validateSubmission({ now: '2026-08-15T10:00:00Z', week, fixtures, picks: { '10': 'H' }, tiebreak: 27, numbers: nums });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'picks_incomplete');
  assert.deepStrictEqual(r.missing.sort(), [11, 12, 13, 14]);
});
test('rejects picks after kickoff, allows numbers-only', () => {
  const late = validateSubmission({ now: '2026-08-15T15:00:00Z', week, fixtures, picks: goodPicks, tiebreak: 27, numbers: nums });
  assert.strictEqual(late.ok, false);
  assert.strictEqual(late.error, 'picks_late');
  const numbersOnly = validateSubmission({ now: '2026-08-15T15:00:00Z', week, fixtures, picks: null, numbers: nums });
  assert.strictEqual(numbersOnly.ok, true);
  assert.strictEqual(numbersOnly.picksIncluded, false);
});
test('rejects everything after numbers close', () => {
  const r = validateSubmission({ now: '2026-08-15T20:00:01Z', week, fixtures, picks: null, numbers: nums });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'entries_closed');
});
test('rejects bad number sets', () => {
  assert.strictEqual(validateSubmission({ now: '2026-08-15T10:00:00Z', week, fixtures, picks: goodPicks, tiebreak: 1, numbers: [1,2,3,4,5,6] }).ok, false);
  assert.strictEqual(validateSubmission({ now: '2026-08-15T10:00:00Z', week, fixtures, picks: goodPicks, tiebreak: 1, numbers: [1,2,3,4,5,6,6] }).ok, false);
  assert.strictEqual(validateSubmission({ now: '2026-08-15T10:00:00Z', week, fixtures, picks: goodPicks, tiebreak: 1, numbers: [1,2,3,4,5,6,50] }).ok, false);
});
test('requires tie-break with picks', () => {
  const r = validateSubmission({ now: '2026-08-15T10:00:00Z', week, fixtures, picks: goodPicks, tiebreak: null, numbers: nums });
  assert.strictEqual(r.error, 'tiebreak_invalid');
});

console.log('rules.js — scoring');
test('scores picks, excluding void and undecided fixtures', () => {
  const s = scorePicks(goodPicks, fixtures);
  assert.strictEqual(s.correct, 2);  // 10:H ✓, 11:H ✗, 12:A ✓; 13 void; 14 undecided
  assert.strictEqual(s.decided, 3);
});
test('ranks winners with tie-break', () => {
  const entries = [
    { id: 1, picks: { '10': 'H', '11': 'D', '12': 'A' }, tiebreak: 20 }, // 3 correct
    { id: 2, picks: { '10': 'H', '11': 'D', '12': 'A' }, tiebreak: 26 }, // 3 correct, closer to 27
    { id: 3, picks: { '10': 'H', '11': 'H', '12': 'H' }, tiebreak: 27 }  // 1 correct
  ];
  const { winners } = rankEntries(entries, fixtures.slice(0, 3), 27);
  assert.strictEqual(winners.length, 1);
  assert.strictEqual(winners[0].id, 2);
});
test('exact tie shares the prize', () => {
  const entries = [
    { id: 1, picks: { '10': 'H' }, tiebreak: 27 },
    { id: 2, picks: { '10': 'H' }, tiebreak: 27 }
  ];
  const { winners } = rankEntries(entries, [{ id: 10, result: 'H' }], 27);
  assert.strictEqual(winners.length, 2);
});

console.log('rules.js — pool & tiers');
test('full pool at threshold, fallback below', () => {
  assert.deepStrictEqual(computePool(week, 25), { pool: 100000, reduced: false });
  assert.deepStrictEqual(computePool(week, 10), { pool: 40000, reduced: true }); // 10×5000×80%
});
test('number tiers', () => {
  const drawn = [1, 2, 3, 4, 5, 6, 7];
  assert.strictEqual(numberTier([1, 2, 3, 4, 5, 6, 7], drawn), 'jackpot');
  assert.strictEqual(numberTier([1, 2, 3, 4, 5, 6, 40], drawn), 'match6');
  assert.strictEqual(numberTier([1, 2, 3, 4, 5, 40, 41], drawn), 'match5');
  assert.strictEqual(numberTier([1, 2, 3, 4, 40, 41, 42], drawn), null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
