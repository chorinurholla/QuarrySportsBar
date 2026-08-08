'use strict';
/** POST /api/submit — public: the authoritative entry write.
 *  Server clock enforces cut-offs; submit_entry() in Postgres makes the
 *  code-redeem + entry-insert atomic. */
const { db, json, currentWeek, makeReference } = require('./_shared');
const { normalizeCode, normalizePhone, validateSubmission } = require('../../lib/rules');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  try {
    const body = JSON.parse(event.body || '{}');
    const code = normalizeCode(body.code);
    const phone = normalizePhone(body.phone);
    if (!code) return json(400, { error: 'code_format', message: 'Check the digits on your receipt.' });
    if (!phone) return json(400, { error: 'phone_invalid', message: 'Enter a valid Nigerian phone number.' });

    const client = db();
    const cw = await currentWeek(client);
    if (!cw) return json(409, { error: 'entries_closed', message: 'No competition week is open.' });

    const check = validateSubmission({
      now: Date.now(),
      week: cw.week,
      fixtures: cw.fixtures,
      picks: body.picks,
      tiebreak: body.tiebreak,
      numbers: body.numbers
    });
    if (!check.ok) return json(422, check);

    // Insert atomically; retry reference on the (rare) unique collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const reference = makeReference();
      const { data, error } = await client.rpc('submit_entry', {
        p_week_id: cw.week.id,
        p_code: code,
        p_reference: reference,
        p_first_name: (body.first_name || '').slice(0, 40),
        p_phone: phone,
        p_picks: check.picksIncluded ? body.picks : null,
        p_tiebreak: check.picksIncluded ? Number(body.tiebreak) : null,
        p_numbers: check.numbers,
        p_optin: !!body.whatsapp_optin
      });
      if (!error) {
        return json(200, {
          ok: true,
          reference: data[0].reference,
          picksIncluded: check.picksIncluded
        });
      }
      const msg = String(error.message || '');
      if (msg.includes('code_not_found')) return json(404, { error: 'code_not_found', message: 'Code not found. Check your receipt, or ask at the bar.' });
      if (msg.includes('code_used'))      return json(409, { error: 'code_used', message: 'This code has already submitted picks. One entry per person.' });
      if (msg.includes('code_wrong_week'))return json(409, { error: 'code_wrong_week', message: 'This code is from a different Saturday.' });
      if (msg.includes('code_void'))      return json(409, { error: 'code_void', message: 'This code has been cancelled. Ask at the bar.' });
      if (msg.includes('entries_reference_key') || msg.includes('duplicate key')) continue; // retry new reference
      throw error;
    }
    return json(500, { error: 'reference_exhausted' });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'server_error' });
  }
};
