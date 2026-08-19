/* ==========================================================================
   Quarry Sports Bar — front-end behaviour
   Runs in two modes, switched by window.QUARRY_API (see config.js):
     • DEMO (API null): Play flow on sample data, entries not stored.
     • LIVE (API set): fixtures, code validation and submission via the
       Phase 2 backend; server clock enforces all cut-offs.
   ========================================================================== */

(function () {
  'use strict';

  var API = window.QUARRY_API || null;

  /* ---------- Mobile nav (all pages) ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    });
  }

  /* ---------- Draw verifier (winners page) ---------- */
  var verifyForm = document.getElementById('verify-form');
  if (verifyForm && window.crypto && window.crypto.subtle) {
    verifyForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var outEl = document.getElementById('verify-out');
      try {
        var seed = document.getElementById('verify-seed').value.trim();
        var commit = document.getElementById('verify-commit').value.trim().toLowerCase();
        var numsRaw = document.getElementById('verify-numbers').value.trim();
        var claimed = numsRaw.split(/[,\s]+/).filter(Boolean).map(Number);
        var enc = new TextEncoder();
        async function sha256Hex(s) {
          var buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
          return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        }
        var seedHash = await sha256Hex(seed);
        if (seedHash !== commit) {
          outEl.textContent = '✗ FAILED — the seed does not match the committed fingerprint.';
          outEl.className = 'notice'; outEl.style.borderLeftColor = 'var(--error)';
          return;
        }
        // Derive the full bingo drawing sequence — mirrors the server exactly
        var derived = []; for (var k = 0; k < 50; k++) derived.push(k);
        var counter = 0;
        for (var i2 = 49; i2 > 0; i2--) {
          var h = await sha256Hex(seed + ':' + counter); counter++;
          var j2 = parseInt(h.slice(0, 8), 16) % (i2 + 1);
          var tmp = derived[i2]; derived[i2] = derived[j2]; derived[j2] = tmp;
        }
        var match = claimed.length > 0 && claimed.length <= 50 &&
          claimed.every(function (n, i) { return derived[i] === n; });
        outEl.textContent = match
          ? '✓ VERIFIED — the seed matches the fingerprint published before entries closed, and it derives exactly this drawing order: ' + derived.slice(0, claimed.length).join(', ')
          : '✗ FAILED — the seed is genuine but the real drawing order starts ' + derived.slice(0, Math.min(claimed.length || 12, 12)).join(', ') + '…, not the numbers entered.';
        outEl.className = 'notice';
        outEl.style.borderLeftColor = match ? 'var(--success)' : 'var(--error)';
      } catch (err) {
        outEl.textContent = 'Could not verify — check the values and try again.';
      }
    });
  }

  /* ---------- Shared live helpers ---------- */
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function fmtDay(dateStr) {
    try { return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' }); }
    catch (e) { return ''; }
  }

  /* ---------- Winners page: live draw status + archive ---------- */
  var drawStatusBox = document.getElementById('draw-status');
  if (API && drawStatusBox) {
    (async function winnersLive() {
      try {
        var res = await fetch(API + '/week');
        var data = await res.json();
        var w = data && data.week;
        if (w && (w.draw_commit || w.drawn_numbers)) {
          var body = document.getElementById('draw-status-body');
          var html = '';
          if (w.drawn_numbers) {
            var upto = w.winning_ball || w.drawn_numbers.length;
            html += '<p><strong>BINGO on ball ' + upto + '.</strong> Drawn order: <span class="num">' + w.drawn_numbers.slice(0, upto).join(', ') + '</span></p>';
            html += '<p style="margin-top:8px"><strong>Fingerprint (published before numbers closed):</strong><br><code style="word-break:break-all">' + w.draw_commit + '</code></p>';
            html += '<p style="margin-top:8px"><strong>Seed (revealed at the draw):</strong><br><code style="word-break:break-all">' + w.draw_seed + '</code></p>';
            html += '<p class="muted" style="margin-top:8px">These values are pre-filled into the checker below — just press &quot;Verify the draw&quot;.</p>';
            var vc = document.getElementById('verify-commit'); if (vc) vc.value = w.draw_commit;
            var vs = document.getElementById('verify-seed'); if (vs) vs.value = w.draw_seed;
            var vn = document.getElementById('verify-numbers'); if (vn) vn.value = w.drawn_numbers.slice(0, w.winning_ball || w.drawn_numbers.length).join(', ');
          } else {
            html += '<p><strong>The draw is committed and sealed.</strong> Numbers revealed at ' + fmtTime(w.draw_time) + ' on the big screen.</p>';
            html += '<p style="margin-top:8px"><strong>Fingerprint:</strong><br><code style="word-break:break-all">' + w.draw_commit + '</code></p>';
          }
          body.innerHTML = html;
          drawStatusBox.hidden = false;
        }
      } catch (e) { /* stay hidden */ }
      try {
        var res2 = await fetch(API + '/winners');
        var arch = await res2.json();
        if (arch && arch.weeks && arch.weeks.length) {
          var live = document.getElementById('archive-live');
          var sample = document.getElementById('archive-sample');
          var total = 0, count = arch.weeks.length;
          live.innerHTML = '';
          arch.weeks.forEach(function (wk) {
            var art = document.createElement('article');
            art.className = 'week-entry';
            var picksW = wk.winners.filter(function (x) { return x.kind === 'picks'; });
            var tiers = wk.winners.filter(function (x) { return x.kind !== 'picks'; });
            wk.winners.forEach(function (x) { total += (x.amount || 0); });
            var h = '<header><h3 class="num">' + fmtDay(wk.saturday) + ' ' + wk.saturday + '</h3></header>';
            picksW.forEach(function (p) {
              h += '<p><strong></strong> — Match Picks · won <span class="hl num">₦' + Number(p.amount).toLocaleString('en-NG') + '</span></p>';
            });
            if (!picksW.length) h += '<p class="muted">Match Picks winner recorded at the bar.</p>';
            var upto2 = wk.winning_ball || Math.min(wk.drawn_numbers.length, 50);
            h += '<p class="caps" style="margin-top:16px">Bingo on ball ' + upto2 + ' — drawn order</p><div class="numbers-line">' +
              wk.drawn_numbers.slice(0, upto2).map(function (n) { return '<span class="n7">' + n + '</span>'; }).join('') + '</div>';
            if (tiers.length) {
              h += '<p class="muted small" style="margin-top:12px">' + tiers.map(function (t) {
                return 'BINGO · ₦' + Number(t.amount).toLocaleString('en-NG') + ' credit';
              }).join(' — ') + '</p>';
            }
            art.innerHTML = h;
            // names inserted via textContent to stay XSS-safe
            var strongs = art.querySelectorAll('p strong');
            picksW.forEach(function (p, i) { if (strongs[i]) strongs[i].textContent = p.display_name; });
            live.appendChild(art);
          });
          if (sample) sample.hidden = true;
          live.hidden = false;
          var pt = document.getElementById('paid-total');
          var pl = document.getElementById('paid-label');
          if (pt && total > 0) pt.textContent = '₦' + total.toLocaleString('en-NG');
          if (pl && total > 0) pl.textContent = 'paid out across ' + count + ' match day' + (count === 1 ? '' : 's');
        }
      } catch (e) { /* keep sample layout */ }
    })();
  }

  /* ---------- Play page ---------- */
  var playRoot = document.getElementById('play-flow');
  if (!playRoot) return;

  var codeForm = document.getElementById('code-form');
  var codeField = document.getElementById('entry-code');
  var codeFieldWrap = codeField ? codeField.closest('.field') : null;
  var codeMsg = document.getElementById('code-msg');
  var picksSection = document.getElementById('picks-section');
  var numbersSection = document.getElementById('numbers-section');
  var confirmSection = document.getElementById('confirm-section');
  var fixtureList = document.getElementById('fixture-list');
  var rail = document.getElementById('progress-rail');
  var railText = document.getElementById('rail-text');
  var railSubmit = document.getElementById('rail-submit');

  var picks = {};   // fixtureId -> 'H' | 'D' | 'A'
  var chosen = [];  // numbers
  var week = null;  // live week payload
  var fixtures = [];

  var SAMPLE_FIXTURES = [
    { id: 1, league: 'Premier League', home: 'Arsenal', away: 'Everton', ko: '13:30' },
    { id: 2, league: 'Premier League', home: 'Brentford', away: 'Fulham', ko: '16:00' },
    { id: 3, league: 'Premier League', home: 'Newcastle', away: 'Villa', ko: '16:00' },
    { id: 4, league: 'Premier League', home: 'Brighton', away: 'Wolves', ko: '16:00' },
    { id: 5, league: 'Premier League', home: 'Chelsea', away: 'Spurs', ko: '18:30' },
    { id: 6, league: 'Bundesliga', home: 'Dortmund', away: 'Leipzig', ko: '16:30' },
    { id: 7, league: 'Bundesliga', home: 'Frankfurt', away: 'Freiburg', ko: '16:30' },
    { id: 8, league: 'Bundesliga', home: 'Stuttgart', away: 'Mainz', ko: '19:30' },
    { id: 9, league: 'La Liga', home: 'Sevilla', away: 'Real Betis', ko: '17:00' },
    { id: 10, league: 'La Liga', home: 'Girona', away: 'Valencia', ko: '19:30' },
    { id: 11, league: 'La Liga', home: 'Villarreal', away: 'Osasuna', ko: '21:00' }
  ];

  function koLabel(f) {
    if (f.ko) return f.ko;
    var d = new Date(f.kickoff_at);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function renderFixtures() {
    fixtureList.innerHTML = '';
    var league = '';
    var frag = document.createDocumentFragment();
    // Day label follows the real match day (works for midweek cards too)
    var dayLabel = 'Saturday';
    if (week && week.saturday) {
      try {
        dayLabel = new Date(week.saturday + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
      } catch (e) { /* keep default */ }
    }
    fixtures.forEach(function (f) {
      if (f.league !== league) {
        league = f.league;
        var head = document.createElement('div');
        head.className = 'league-head';
        head.innerHTML = '<span class="caps"></span><span class="muted small num"></span>';
        head.firstChild.textContent = league;
        head.lastChild.textContent = dayLabel;
        frag.appendChild(head);
      }
      var row = document.createElement('div');
      row.className = 'fixture';
      row.dataset.id = f.id;
      var info = document.createElement('div');
      info.innerHTML = '<div class="teams"></div><div class="ko num"></div>';
      info.querySelector('.teams').textContent = f.home + ' vs ' + f.away;
      info.querySelector('.ko').textContent = koLabel(f) + ' kickoff';
      var seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'radiogroup');
      seg.setAttribute('aria-label', f.home + ' versus ' + f.away);
      ['Home', 'Draw', 'Away'].forEach(function (opt) {
        var b = document.createElement('button');
        b.type = 'button'; b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', 'false');
        b.dataset.pick = opt[0]; b.textContent = opt;
        seg.appendChild(b);
      });
      row.appendChild(info); row.appendChild(seg);
      frag.appendChild(row);
    });
    fixtureList.appendChild(frag);
  }

  function updateRail() {
    var total = fixtures.length;
    var done = Object.keys(picks).length;
    railText.textContent = done + ' of ' + total + ' matches picked · ' + chosen.length + ' of 7 numbers';
    railSubmit.disabled = !(done === total && chosen.length === 7);
  }

  fixtureList.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-pick]');
    if (!btn) return;
    var row = btn.closest('.fixture');
    row.classList.remove('err');
    row.querySelectorAll('button[data-pick]').forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
    btn.setAttribute('aria-checked', 'true');
    picks[row.dataset.id] = btn.dataset.pick;
    updateRail();
    saveDraft();
  });

  /* Number grid */
  var grid = document.getElementById('number-grid');
  var tray = document.getElementById('number-tray');
  function renderGrid() {
    for (var n = 0; n <= 49; n++) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = n;
      b.setAttribute('aria-pressed', 'false'); b.dataset.n = n;
      grid.appendChild(b);
    }
  }
  function renderTray() {
    tray.querySelectorAll('.slot').forEach(function (slot, i) {
      if (chosen[i] !== undefined) { slot.textContent = chosen[i]; slot.classList.add('full'); }
      else { slot.textContent = '·'; slot.classList.remove('full'); }
    });
    document.getElementById('tray-count').textContent = chosen.length + ' of 7 chosen';
    updateRail();
  }
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-n]');
    if (!b) return;
    var n = Number(b.dataset.n);
    var i = chosen.indexOf(n);
    if (i > -1) { chosen.splice(i, 1); b.setAttribute('aria-pressed', 'false'); }
    else if (chosen.length < 7) { chosen.push(n); b.setAttribute('aria-pressed', 'true'); }
    else {
      document.getElementById('tray-count').textContent = 'You already have 7 — tap one to remove it first';
      return;
    }
    renderTray();
    saveDraft();
  });
  document.getElementById('surprise-me').addEventListener('click', function () {
    while (chosen.length < 7) {
      var n = Math.floor(Math.random() * 50);
      if (chosen.indexOf(n) === -1) {
        chosen.push(n);
        grid.querySelector('button[data-n="' + n + '"]').setAttribute('aria-pressed', 'true');
      }
    }
    renderTray();
    saveDraft();
  });
  document.getElementById('clear-numbers').addEventListener('click', function () {
    chosen.length = 0;
    grid.querySelectorAll('button[data-n]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    renderTray();
    saveDraft();
  });

  function showError(message) {
    codeFieldWrap.classList.add('error');
    codeMsg.textContent = message;
    codeField.focus();
  }
  function proceedToPicks() {
    picksSection.hidden = false;
    numbersSection.hidden = false;
    rail.hidden = false;
    document.getElementById('code-section').hidden = true;
    restoreDraft();
    var tb = document.getElementById('tiebreak');
    if (tb) tb.addEventListener('input', saveDraft);
    var fn = document.getElementById('first-name');
    if (fn) fn.addEventListener('input', saveDraft);
    var h = picksSection.querySelector('h2');
    h.setAttribute('tabindex', '-1'); h.focus();
  }

  /* Code redemption */
  codeForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    codeFieldWrap.classList.remove('error');
    codeMsg.textContent = '';
    var val = codeField.value.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^QRY-?\d{4}$/.test(val)) {
      showError(API
        ? 'Check the digits on your receipt — codes look like QRY-1234.'
        : 'Check the digits on your receipt — codes look like QRY-1234. (Demo: any QRY + 4 digits works.)');
      return;
    }
    if (!API) { proceedToPicks(); return; }
    try {
      var res = await fetch(API + '/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: val })
      });
      var data = await res.json();
      if (!res.ok) { showError(data.message || 'Something went wrong — try again or ask at the bar.'); return; }
      proceedToPicks();
    } catch (err) {
      showError('Network problem — check your connection and try again.');
    }
  });

  /* Submit */
  railSubmit.addEventListener('click', async function () {
    var missing = fixtures.filter(function (f) { return !picks[f.id]; });
    if (missing.length || chosen.length !== 7) {
      missing.forEach(function (f) {
        fixtureList.querySelector('.fixture[data-id="' + f.id + '"]').classList.add('err');
      });
      return;
    }
    var reference = 'REF-DEMO';
    if (API) {
      railSubmit.disabled = true;
      railSubmit.textContent = 'Submitting…';
      try {
        var res = await fetch(API + '/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: codeField.value.trim(),
            phone: (document.getElementById('phone') || {}).value || '',
            first_name: (document.getElementById('first-name') || {}).value || '',
            picks: picks,
            tiebreak: Number((document.getElementById('tiebreak') || {}).value || 0),
            numbers: chosen,
            whatsapp_optin: !!(document.getElementById('whatsapp-optin') || {}).checked
          })
        });
        var data = await res.json();
        if (!res.ok) {
          railSubmit.disabled = false;
          railSubmit.textContent = 'Review & submit';
          alertRegion(data.message || 'Could not submit — try again or ask at the bar.');
          return;
        }
        reference = data.reference;
      } catch (err) {
        railSubmit.disabled = false;
        railSubmit.textContent = 'Review & submit';
        alertRegion('Network problem — your entry was NOT submitted. Try again.');
        return;
      }
    }
    clearDraft();
    picksSection.hidden = true;
    numbersSection.hidden = true;
    rail.hidden = true;
    confirmSection.hidden = false;
    var refEl = confirmSection.querySelector('.ref');
    if (refEl) refEl.textContent = reference;
    var sorted = chosen.slice().sort(function (a, b) { return a - b; });
    document.getElementById('readback').textContent =
      'Numbers: ' + sorted.join(', ') + ' · submitted before cut-off.';

    /* Full picks read-back — one line per match, like the numbers */
    var PICK_WORD = { H: 'Home', D: 'Draw', A: 'Away' };
    var pickLines = fixtures.map(function (f) {
      return f.home + ' vs ' + f.away + ' — ' + (PICK_WORD[picks[f.id]] || '–');
    });
    var tbVal = (document.getElementById('tiebreak') || {}).value;
    if (tbVal !== '' && tbVal != null) pickLines.push('Tie-break (total goals) — ' + tbVal);
    var picksBox = document.getElementById('readback-picks');
    if (picksBox) {
      picksBox.innerHTML = '';
      pickLines.forEach(function (line) {
        var p = document.createElement('p');
        p.textContent = line;
        picksBox.appendChild(p);
      });
    }

    /* One-tap: save the whole slip into the customer's WhatsApp (chat with the bar) */
    var waBtn = document.getElementById('wa-slip');
    if (waBtn) {
      var slipText = 'My Quarry Sports Bar entry — ' + reference + '\n'
        + pickLines.join('\n') + '\n'
        + 'Lucky numbers: ' + sorted.join(', ');
      waBtn.href = 'https://wa.me/2349135593111?text=' + encodeURIComponent(slipText);
      waBtn.hidden = false;
    }
    var h = confirmSection.querySelector('h2');
    h.setAttribute('tabindex', '-1'); h.focus();
    window.scrollTo({ top: confirmSection.offsetTop - 80, behavior: 'smooth' });
  });

  function alertRegion(msg) {
    codeMsg.textContent = msg; // aria-live region reused for submit errors
    var el = document.createElement('p');
    el.className = 'msg'; el.setAttribute('role', 'alert'); el.textContent = msg;
    railText.textContent = msg;
  }

  /* No-play states: never leave the page silently empty. */
  /* ---------- Live mode: status bar, leaderboard, draw panel ---------- */
  var STATE_LABEL = { teaser: 'Card published', open: 'Entries open', live: 'Matches live', results: 'Results are in', settled: 'Match day complete', void: 'Match day void' };
  function updateStatusBar() {
    if (!week) return;
    var st = document.getElementById('status-state');
    var ck = document.getElementById('status-clock');
    if (st) {
      st.innerHTML = '<em class="caps"></em> ';
      st.querySelector('em').textContent = STATE_LABEL[week.state] || week.state;
      st.appendChild(document.createTextNode(fmtDay(week.saturday) + ' card'));
    }
    if (ck) {
      ck.textContent = week.drawn_numbers
        ? 'Draw complete — results below'
        : 'Closes ' + fmtDay(week.saturday) + ' ' + fmtTime(week.picks_cutoff) + ' · numbers ' + fmtTime(week.numbers_close);
    }
  }
  async function refreshWeek() {
    try {
      var res = await fetch(API + '/week');
      var data = await res.json();
      if (data && data.week) week = data.week;
    } catch (e) { /* keep last known */ }
  }
  async function refreshLive() {
    if (!API || !week) return;
    try {
      var res = await fetch(API + '/leaderboard');
      var data = await res.json();
      var box = document.getElementById('board-rows');
      var badge = document.getElementById('board-badge');
      if (box && data && data.rows) {
        if (badge) badge.textContent = data.final ? 'FINAL' : 'LIVE';
        box.innerHTML = '';
        /* All matches decided → the system names the winner. Claims are checked
           against this, never the other way round. */
        if (data.final && data.final.winners && data.final.winners.length) {
          var fin = document.createElement('div');
          fin.className = 'lrow';
          fin.style.cssText = 'background:var(--ink,#141414);color:#F3F3F3;font-weight:700;padding:12px;display:block';
          var names = data.final.winners.map(function (w) { return w.display; }).join(', ');
          fin.textContent = (data.final.shared ? 'FINAL — winners (shared): ' : 'FINAL — winner: ')
            + names + ' with ' + data.final.correct + ' correct'
            + (data.final.tiebreakUsed ? ' (won on the total-goals tie-break — ' + data.final.totalGoals + ' goals)' : '')
            + '. Claim at the bar with your REF number and ID.';
          box.appendChild(fin);
        }
        if (!data.rows.length) {
          var p = document.createElement('p');
          p.className = 'muted small';
          p.textContent = 'No entries on the board yet — be the first.';
          box.appendChild(p);
        } else {
          data.rows.forEach(function (r, i) {
            var d = document.createElement('div');
            d.className = 'lrow';
            d.innerHTML = '<span class="rank num"></span><span></span><span class="pts num"></span>';
            d.children[0].textContent = i + 1;
            d.children[1].textContent = r.display;
            d.children[2].textContent = r.correct;
            box.appendChild(d);
          });
        }
      }
    } catch (e) { /* keep current board */ }
    var balls = document.getElementById('draw-balls');
    var note = document.getElementById('draw-note');
    var title = document.getElementById('draw-title');
    var lede = document.getElementById('live-lede');
    if (title && fmtTime(week.draw_time)) title.textContent = fmtTime(week.draw_time) + ' — lights down for the draw';
    if (lede) lede.textContent = 'Live standings update automatically. At ' + fmtTime(week.draw_time) + ', the lights go down for the draw.';
    if (balls) {
      if (week.drawn_numbers) {
        var upto = week.winning_ball || Math.min(week.drawn_numbers.length, 50);
        balls.innerHTML = week.drawn_numbers.slice(0, upto).map(function (n) { return '<div class="ball">' + Number(n) + '</div>'; }).join('');
        if (note) note.innerHTML = '<strong>BINGO on ball ' + upto + '!</strong> First slip to complete all 7 wins ₦20,000 credit. <a href="winners.html#draw" style="color:var(--night-text)">Verify it yourself</a>.';
      } else {
        balls.innerHTML = '';
        if (note) note.textContent = week.draw_commit
          ? 'The draw is committed and sealed — numbers revealed at ' + fmtTime(week.draw_time) + ' on the big screen.'
          : 'Numbers close at ' + fmtTime(week.numbers_close) + '; drawn live at ' + fmtTime(week.draw_time) + ' on the big screen.';
      }
    }
  }

  /* ---------- Draft autosave (live mode): picks survive a refresh ---------- */
  var DRAFT_KEY = null;
  function saveDraft() {
    if (!DRAFT_KEY) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        picks: picks,
        chosen: chosen,
        tiebreak: (document.getElementById('tiebreak') || {}).value || '',
        first_name: (document.getElementById('first-name') || {}).value || ''
      }));
    } catch (e) { /* private mode etc. */ }
  }
  function clearDraft() {
    if (!DRAFT_KEY) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  function restoreDraft() {
    if (!DRAFT_KEY) return;
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.picks) Object.keys(d.picks).forEach(function (id) {
        var row = fixtureList.querySelector('.fixture[data-id="' + id + '"]');
        if (!row) return;
        var btn = row.querySelector('button[data-pick="' + d.picks[id] + '"]');
        if (btn) {
          row.querySelectorAll('button[data-pick]').forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
          btn.setAttribute('aria-checked', 'true');
          picks[id] = d.picks[id];
        }
      });
      if (Array.isArray(d.chosen)) d.chosen.forEach(function (n) {
        n = Number(n);
        if (chosen.length < 7 && chosen.indexOf(n) === -1 && n >= 0 && n <= 49) {
          chosen.push(n);
          var b = grid.querySelector('button[data-n="' + n + '"]');
          if (b) b.setAttribute('aria-pressed', 'true');
        }
      });
      var tb = document.getElementById('tiebreak');
      if (d.tiebreak && tb && !tb.value) tb.value = d.tiebreak;
      var fn = document.getElementById('first-name');
      if (d.first_name && fn && !fn.value) fn.value = d.first_name;
      renderTray();
      updateRail();
    } catch (e) { /* corrupt draft: ignore */ }
  }

  function showNoPlay(unreachable) {
    var cs = document.getElementById('code-section');
    cs.hidden = false;
    var form = document.getElementById('code-form');
    if (form) form.hidden = true;
    var h = cs.querySelector('h2');
    var lede = cs.querySelector('.lede');
    if (unreachable) {
      h.textContent = "We can't reach the competition server.";
      lede.textContent = 'Check your connection and refresh. If this keeps happening at the bar on a Saturday, tell the staff — paper entries apply (see Rules).';
    } else {
      h.textContent = 'No card is open right now.';
      lede.textContent = "The next Saturday card drops on Thursday — check back then, or ask at the bar to get it on WhatsApp the moment it lands.";
    }
  }

  /* Init: live fixtures if API, sample otherwise */
  (async function init() {
    if (API) {
      var unreachable = false;
      try {
        var res = await fetch(API + '/week');
        if (!res.ok) throw new Error('status ' + res.status);
        var data = await res.json();
        if (data && data.week) week = data.week;
        if (data && Array.isArray(data.fixtures)) fixtures = data.fixtures;
      } catch (err) { unreachable = true; }
      if (week) {
        DRAFT_KEY = 'qsb-draft-' + week.id;
        updateStatusBar();
        refreshLive();
        setInterval(async function () {
          await refreshWeek();
          updateStatusBar();
          refreshLive();
        }, 90000);
      }
      if (!fixtures.length) {
        showNoPlay(unreachable);
        return;
      }
    } else {
      fixtures = SAMPLE_FIXTURES;
    }
    renderFixtures();
    renderGrid();
    renderTray();
    updateRail();
  })();
})();
