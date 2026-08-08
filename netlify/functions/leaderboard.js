'use strict';
/** GET /api/leaderboard — public: live standings for the current week. */
const { db, json, currentWeek } = require('./_shared');

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
    const decided = cw.fixtures.filter(f => ['H', 'D', 'A'].includes(f.result)).length;
    return json(200, {
      week_id: cw.week.id,
      state: cw.week.state,
      decided,
      total: cw.fixtures.filter(f => f.result !== 'V').length,
      rows: data
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
