'use strict';
/** GET /api/leaderboard — public: live standings for the current week.
 *  Once EVERY non-void fixture has a result, the response also carries a
 *  `final` block naming the winner(s), computed server-side from the same
 *  rules as the tests (most correct → closest total-goals tie-break → share).
 *  The winner is decided by the system, never by whoever claims first. */
const { db, json, currentWeek } = require('./_shared');
const { rankEntries } = require('../../lib/rules');

function mask(e) {
  const name = (e.first_name || '').trim() || 'Player';
  return name + ' ··' + String(e.reference || '').slice(-3);
}

exports.handler = async () => {
  try {
    const client = db();
    const cw = await currentWeek(client);
    if (!cw) return json(200, { rows: [] });
    const { data, error } = await client
      .from('leaderboard')
      .select('entry_id, display, correct, tiebreak')
      .eq('week_id', cw.week.id)
      .order('correct', { ascending: false })
      .limit(200);
    if (error) throw error;

    const playable = cw.fixtures.filter(f => f.result !== 'V');
    const decided = playable.filter(f => ['H', 'D', 'A'].includes(f.result)).length;

    // Final declaration: all playable fixtures decided → compute the winner(s).
    let final = null;
    if (playable.length > 0 && decided === playable.length) {
      const { data: fxFull, error: e2 } = await client
        .from('fixtures')
        .select('id, result, home_goals, away_goals')
        .eq('week_id', cw.week.id);
      if (e2) throw e2;
      const scored = fxFull.filter(f => ['H', 'D', 'A'].includes(f.result));
      const haveGoals = scored.every(f => Number.isInteger(f.home_goals) && Number.isInteger(f.away_goals));
      const totalGoals = haveGoals
        ? scored.reduce((s, f) => s + f.home_goals + f.away_goals, 0)
        : null; // no goals recorded → rankEntries leaves exact ties to share
      const { data: entries, error: e3 } = await client
        .from('entries')
        .select('id, first_name, reference, picks, tiebreak')
        .eq('week_id', cw.week.id)
        .not('picks', 'is', null);
      if (e3) throw e3;
      const ranked = rankEntries(entries || [], fxFull, totalGoals);
      if (ranked.winners.length) {
        final = {
          correct: ranked.winners[0].score,
          totalGoals,
          tiebreakUsed: totalGoals != null && ranked.table.filter(t => t.score === ranked.winners[0].score).length > 1,
          shared: ranked.winners.length > 1,
          winners: ranked.winners.map(w => ({ display: mask(w), reference_hint: String(w.reference || '').slice(-3) }))
        };
      }
    }

    return json(200, {
      week_id: cw.week.id,
      state: cw.week.state,
      decided,
      total: playable.length,
      final,
      rows: data
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
