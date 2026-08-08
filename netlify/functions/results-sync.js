'use strict';
/** Scheduled (or admin-triggered) results sync from football-data.org.
 *  Netlify scheduled function: every 2 minutes on Saturdays (see netlify.toml).
 *  Maps fixtures by external_id; sets result H/D/A when a match is FINISHED. */
const { db, json, currentWeek } = require('./_shared');

exports.handler = async () => {
  try {
    const client = db();
    const cw = await currentWeek(client);
    if (!cw || !['open', 'live'].includes(cw.week.state)) return json(200, { skipped: true });

    const withExt = cw.fixtures.filter(f => f.external_id);
    if (!withExt.length) return json(200, { skipped: 'no_external_ids' });

    // Move to live once past first kickoff
    if (cw.week.state === 'open' && Date.now() > new Date(cw.week.picks_cutoff).getTime()) {
      await client.from('weeks').update({ state: 'live' }).eq('id', cw.week.id);
    }

    const ids = withExt.map(f => f.external_id).join(',');
    const res = await fetch('https://api.football-data.org/v4/matches?ids=' + ids, {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY }
    });
    if (!res.ok) return json(502, { error: 'football_api', status: res.status });
    const data = await res.json();

    let updated = 0;
    for (const m of data.matches || []) {
      if (m.status !== 'FINISHED') continue;
      const fx = withExt.find(f => String(f.external_id) === String(m.id));
      if (!fx || fx.result) continue;
      const w = m.score && m.score.winner;
      const result = w === 'HOME_TEAM' ? 'H' : w === 'AWAY_TEAM' ? 'A' : 'D';
      const { error } = await client.from('fixtures').update({ result }).eq('id', fx.id);
      if (!error) updated++;
    }
    return json(200, { ok: true, updated });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
