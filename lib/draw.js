/**
 * Commit–reveal BINGO draw engine.
 * At numbers close, a seed is generated and its SHA-256 hash (the commitment)
 * is published. The seed deterministically derives the ENTIRE drawing sequence
 * (a shuffle of 0–49). At draw time the seed is revealed and the sequence plays
 * ball by ball until the first entry completes all 7 of its numbers — that
 * entry wins (ties on the same ball share). Anyone can verify:
 *   sha256(seed) === published commitment
 *   deriveSequence(seed) === the drawn sequence
 */
'use strict';
const crypto = require('crypto');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/** Generate a fresh random seed (hex) and its commitment. */
function makeCommit() {
  const seed = crypto.randomBytes(32).toString('hex');
  return { seed, commit: sha256Hex(seed) };
}

/** Deterministically derive the full drawing sequence: a permutation of 0–49.
 *  Hash-driven Fisher–Yates; one hash per swap, counter-based, so the client
 *  verifier can reproduce it exactly. */
function deriveSequence(seedHex) {
  const arr = [];
  for (let i = 0; i < 50; i++) arr.push(i);
  let counter = 0;
  for (let i = 49; i > 0; i--) {
    const h = sha256Hex(seedHex + ':' + counter);
    counter++;
    const j = parseInt(h.slice(0, 8), 16) % (i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** Verify a revealed seed against a commitment and a claimed sequence
 *  (full sequence, or any prefix of it — e.g. the balls drawn up to bingo). */
function verify(seedHex, commit, claimed) {
  if (sha256Hex(seedHex) !== commit) return { ok: false, reason: 'seed does not match commitment' };
  const seq = deriveSequence(seedHex);
  if (!Array.isArray(claimed) || claimed.length === 0 || claimed.length > 50) {
    return { ok: false, reason: 'no numbers to check' };
  }
  const same = claimed.every((n, i) => seq[i] === n);
  return same ? { ok: true } : { ok: false, reason: 'numbers do not match derivation' };
}

module.exports = { sha256Hex, makeCommit, deriveSequence, verify };
