/**
 * Commit–reveal draw engine.
 * The seed is generated and its SHA-256 hash (the commitment) is published
 * BEFORE numbers close. At draw time the seed is revealed; the 7 numbers are
 * derived deterministically from it, so anyone can verify:
 *   sha256(seed) === published commitment
 *   deriveNumbers(seed) === drawn numbers
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

/** Deterministically derive 7 distinct numbers 0–49 from a seed. */
function deriveNumbers(seedHex) {
  const numbers = [];
  let counter = 0;
  while (numbers.length < 7) {
    const h = sha256Hex(seedHex + ':' + counter);
    const n = parseInt(h.slice(0, 8), 16) % 50;
    if (!numbers.includes(n)) numbers.push(n);
    counter++;
    if (counter > 10000) throw new Error('derivation runaway'); // unreachable safety
  }
  return numbers;
}

/** Verify a revealed seed against a commitment and drawn numbers. */
function verify(seedHex, commit, drawnNumbers) {
  if (sha256Hex(seedHex) !== commit) return { ok: false, reason: 'seed does not match commitment' };
  const derived = deriveNumbers(seedHex);
  const same = derived.length === drawnNumbers.length && derived.every((n, i) => n === drawnNumbers[i]);
  return same ? { ok: true } : { ok: false, reason: 'numbers do not match derivation' };
}

module.exports = { sha256Hex, makeCommit, deriveNumbers, verify };
