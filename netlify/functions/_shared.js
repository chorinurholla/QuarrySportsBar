'use strict';
const { createClient } = require('@supabase/supabase-js');

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
}

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}

function requireAdmin(event) {
  const key = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return json(401, { error: 'unauthorized' });
  }
  return null;
}

/** Load the current public week (nearest non-draft, non-settled by date) with fixtures. */
async function currentWeek(client) {
  const { data: weeks, error } = await client
    .from('weeks')
    .select('*')
    .neq('state', 'draft')
    .order('saturday', { ascending: false })
    .limit(1);
  if (error) throw error;
  const week = weeks && weeks[0];
  if (!week) return null;
  const { data: fixtures, error: e2 } = await client
    .from('fixtures')
    .select('id, league, home, away, kickoff_at, result, sort')
    .eq('week_id', week.id)
    .order('sort');
  if (e2) throw e2;
  return { week, fixtures };
}

function makeReference() {
  // Short, phonetic-friendly: QRY + 4 digits (collision-checked by unique constraint + retry)
  return 'QRY-' + String(Math.floor(1000 + Math.random() * 9000));
}

module.exports = { db, json, requireAdmin, currentWeek, makeReference };
