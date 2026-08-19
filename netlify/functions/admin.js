'use strict';
/** POST /api/admin — staff operations, guarded by X-Admin-Key header.
 *  One dispatcher keeps the surface small. Actions:
 *    create_week   { saturday, picks_cutoff, numbers_close, draw_time, fixtures:[{league,home,away,kickoff_at,external_id?}] }
 *    set_state     { week_id, state }
 *    issue_codes   { week_id, count }        -> returns codes to print
 *    void_code     { code }
 *    set_result    { fixture_id, result }    -> 'H'|'D'|'A'|'V' (manual/fallback)
 *    lookup        { week_id, phone }        -> entry by phone (lost receipt)
 *    draw_commit   { week_id }               -> generates seed, publishes commitment
 *    draw_reveal   { week_id }               -> reveals seed, stores drawn numbers, returns tier winners
 *    record_winner { week_id, kind, entry_id?, display_name, amount, note?, consent }
 */
const { db, json, requireAdmin } = require('./_shared');
const { makeCommit, deriveSequence } = require('../../lib/draw');
const { bingoWinners } = require('../../lib/rules');

exports.handler = async (event) => {
  const denied = requireAdmin(event);
  if (denied) return denied;
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });

  const client = db();
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'bad_json' }); }

  try {
    switch (body.action) {

      case 'ping': {
        return json(200, { ok: true }); // reached only if the admin key matched
      }

      case 'create_week': {
        // Friendly duplicate check — a week for this date may be left over from
        // an earlier failed attempt, or already created by someone else.
        const { data: existing } = await client.from('weeks')
          .select('id, state').eq('saturday', body.saturday).maybeSingle();
        if (existing) {
          return json(409, {
            error: 'week_exists',
            message: 'A match day for ' + body.saturday + ' already exists (id ' + existing.id +
              ', state "' + existing.state + '"). If it is a leftover from a failed attempt, ' +
              'delete it in Supabase first — in this order: winners, entries, codes, fixtures, weeks — then create it again here.'
          });
        }
        // Validate fixtures BEFORE touching the database, so a bad line can
        // never leave a half-created week behind.
        const fixtures = Array.isArray(body.fixtures) ? body.fixtures : [];
        for (const f of fixtures) {
          if (!f.league || !f.home || !f.away) {
            return json(400, { error: 'bad_fixture', message: 'Missing league/home/away on: ' + JSON.stringify(f) });
          }
          if (!f.kickoff_at || isNaN(Date.parse(f.kickoff_at))) {
            return json(400, { error: 'bad_fixture', message: 'Unreadable kickoff time for ' + f.home + ' v ' + f.away + ' — got "' + f.kickoff_at + '". Use 13:30 or 1:30pm in the time column.' });
          }
        }
        const { data: week, error } = await client.from('weeks').insert({
          saturday: body.saturday,
          state: 'teaser',
          picks_cutoff: body.picks_cutoff,
          numbers_close: body.numbers_close,
          draw_time: body.draw_time,
          min_entries: body.min_entries || 25
        }).select().single();
        if (error) throw error;
        if (fixtures.length) {
          const rows = fixtures.map((f, i) => ({ ...f, week_id: week.id, sort: i }));
          const { error: e2 } = await client.from('fixtures').insert(rows);
          if (e2) {
            // Roll back the week so a retry starts clean instead of hitting a duplicate.
            await client.from('weeks').delete().eq('id', week.id);
            return json(400, { error: 'fixtures_failed', message: 'Fixtures could not be saved (' + e2.message + '). Nothing was created — fix the fixture lines and try again.' });
          }
        }
        return json(200, { ok: true, week_id: week.id });
      }

      case 'set_state': {
        const { error } = await client.from('weeks').update({ state: body.state }).eq('id', body.week_id);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case 'issue_codes': {
        const count = Math.min(Number(body.count) || 0, 500);
        const codes = new Set();
        while (codes.size < count) codes.add('QRY-' + String(Math.floor(1000 + Math.random() * 9000)));
        const rows = [...codes].map(code => ({ code, week_id: body.week_id }));
        const { error } = await client.from('codes').insert(rows);
        if (error) {
          if (String(error.message).includes('duplicate')) return json(409, { error: 'collision_retry', message: 'Code collision — try again.' });
          throw error;
        }
        return json(200, { ok: true, codes: [...codes] });
      }

      case 'void_code': {
        const { error } = await client.from('codes').update({ status: 'void' }).eq('code', body.code).eq('status', 'issued');
        if (error) throw error;
        return json(200, { ok: true });
      }

      case 'set_result': {
        if (!['H', 'D', 'A', 'V'].includes(body.result)) return json(400, { error: 'bad_result' });
        const { error } = await client.from('fixtures').update({ result: body.result }).eq('id', body.fixture_id);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case 'lookup': {
        const { data, error } = await client.from('entries')
          .select('reference, first_name, code, created_at, picks, numbers')
          .eq('week_id', body.week_id).eq('phone', body.phone).limit(5);
        if (error) throw error;
        return json(200, { ok: true, entries: data });
      }

      case 'draw_commit': {
        const { data: w, error } = await client.from('weeks').select('draw_commit').eq('id', body.week_id).single();
        if (error) throw error;
        if (w.draw_commit) return json(409, { error: 'already_committed' });
        const { seed, commit } = makeCommit();
        const { error: e2 } = await client.from('weeks')
          .update({ draw_seed: seed, draw_commit: commit }).eq('id', body.week_id);
        if (e2) throw e2;
        return json(200, { ok: true, commit }); // seed stays server-side until reveal
      }

      case 'draw_reveal': {
        const { data: w, error } = await client.from('weeks')
          .select('draw_seed, draw_commit, drawn_numbers').eq('id', body.week_id).single();
        if (error) throw error;
        if (!w.draw_commit) return json(409, { error: 'not_committed', message: 'Commit the draw first (at 6:30pm).' });
        if (w.drawn_numbers) return json(409, { error: 'already_drawn' });
        const sequence = deriveSequence(w.draw_seed);
        // Bingo winner(s): first entry to complete all 7; ties share
        const { data: entries, error: e3 } = await client.from('entries')
          .select('id, reference, first_name, numbers').eq('week_id', body.week_id);
        if (e3) throw e3;
        const result = bingoWinners(entries || [], sequence);
        const { error: e2 } = await client.from('weeks')
          .update({ drawn_numbers: sequence, winning_ball: result.winningBall }).eq('id', body.week_id);
        if (e2) throw e2;
        return json(200, {
          ok: true,
          winningBall: result.winningBall,
          winners: result.winners.map(e => ({ id: e.id, reference: e.reference, first_name: e.first_name })),
          drawnToBingo: result.winningBall ? sequence.slice(0, result.winningBall) : sequence,
          seed: w.draw_seed, commit: w.draw_commit
        });
      }

      case 'record_winner': {
        const { error } = await client.from('winners').insert({
          week_id: body.week_id, kind: body.kind, entry_id: body.entry_id || null,
          display_name: body.display_name, amount: body.amount, note: body.note || null,
          consent: !!body.consent
        });
        if (error) throw error;
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: 'unknown_action' });
    }
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error', message: String(e.message || e) });
  }
};
