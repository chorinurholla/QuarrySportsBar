'use strict';
/** GET /api/winners — public: archive of completed match days.
 *  Weeks with a revealed draw, newest first, each with its recorded winners.
 *  No phone numbers ever leave the server. */
const { db, json } = require('./_shared');

exports.handler = async () => {
  try {
    const client = db();
    const { data: weeks, error } = await client
      .from('weeks')
      .select('id, saturday, drawn_numbers, state')
      .not('drawn_numbers', 'is', null)
      .order('saturday', { ascending: false })
      .limit(26);
    if (error) throw error;
    if (!weeks || !weeks.length) return json(200, { weeks: [] });

    const ids = weeks.map(w => w.id);
    const { data: winners, error: e2 } = await client
      .from('winners')
      .select('week_id, kind, display_name, amount, note, consent, photo_url')
      .in('week_id', ids);
    if (e2) throw e2;

    const out = weeks.map(w => ({
      saturday: w.saturday,
      state: w.state,
      drawn_numbers: w.drawn_numbers,
      winners: (winners || [])
        .filter(x => x.week_id === w.id)
        .map(x => ({
          kind: x.kind,
          display_name: x.display_name,
          amount: x.amount,
          photo_url: x.consent ? x.photo_url : null
        }))
    }));
    return json(200, { weeks: out });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
