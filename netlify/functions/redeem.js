'use strict';
/** POST /api/redeem { code } — public: pre-flight code check for UX.
 *  The submit function re-validates atomically; this only improves error timing. */
const { db, json, currentWeek } = require('./_shared');
const { normalizeCode } = require('../../lib/rules');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  try {
    const { code: raw } = JSON.parse(event.body || '{}');
    const code = normalizeCode(raw);
    if (!code) return json(400, { error: 'code_format', message: 'Check the digits on your receipt — codes look like QRY-1234.' });

    const client = db();
    const cw = await currentWeek(client);
    if (!cw || !['open', 'live'].includes(cw.week.state)) {
      return json(409, { error: 'entries_closed', message: 'Entries are not open right now.' });
    }
    const { data: rows, error } = await client.from('codes').select('status, week_id').eq('code', code).limit(1);
    if (error) throw error;
    const c = rows && rows[0];
    if (!c) return json(404, { error: 'code_not_found', message: 'Code not found. Check your receipt, or ask at the bar.' });
    if (c.week_id !== cw.week.id) return json(409, { error: 'code_wrong_week', message: 'This code is from a different Saturday. Codes are valid only for the day they were bought.' });
    if (c.status === 'redeemed') return json(409, { error: 'code_used', message: 'This code has already submitted picks. One entry per person. Think this is a mistake? Ask at the bar.' });
    if (c.status === 'void') return json(409, { error: 'code_void', message: 'This code has been cancelled. Ask at the bar.' });

    return json(200, { ok: true, week_id: cw.week.id });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
