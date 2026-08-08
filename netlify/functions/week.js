'use strict';
/** GET /api/week — public: current week, fixtures, cut-offs, draw commitment/results. */
const { db, json, currentWeek } = require('./_shared');

exports.handler = async () => {
  try {
    const client = db();
    const cw = await currentWeek(client);
    if (!cw) return json(200, { week: null });
    const { week, fixtures } = cw;
    return json(200, {
      week: {
        id: week.id,
        saturday: week.saturday,
        state: week.state,
        picks_cutoff: week.picks_cutoff,
        numbers_close: week.numbers_close,
        draw_time: week.draw_time,
        min_entries: week.min_entries,
        pool_full: week.pool_full,
        fallback_pct: week.fallback_pct,
        draw_commit: week.draw_commit,
        // Seed is exposed ONLY after reveal (drawn_numbers set)
        draw_seed: week.drawn_numbers ? week.draw_seed : null,
        drawn_numbers: week.drawn_numbers
      },
      fixtures
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
