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
        var derived = []; var counter = 0;
        while (derived.length < 7 && counter < 10000) {
          var h = await sha256Hex(seed + ':' + counter);
          var n = parseInt(h.slice(0, 8), 16) % 50;
          if (derived.indexOf(n) === -1) derived.push(n);
          counter++;
        }
        var match = derived.length === claimed.length && derived.every(function (n, i) { return n === claimed[i]; });
        outEl.textContent = match
          ? '✓ VERIFIED — the seed matches the fingerprint published before entries closed, and it derives exactly these 7 numbers: ' + derived.join(', ')
          : '✗ FAILED — the seed is genuine but derives ' + derived.join(', ') + ', not the numbers entered.';
        outEl.className = 'notice';
        outEl.style.borderLeftColor = match ? 'var(--success)' : 'var(--error)';
      } catch (err) {
        outEl.textContent = 'Could not verify — check the values and try again.';
      }
    });
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
    fixtures.forEach(function (f) {
      if (f.league !== league) {
        league = f.league;
        var head = document.createElement('div');
        head.className = 'league-head';
        head.innerHTML = '<span class="caps"></span><span class="muted small num">Saturday</span>';
        head.firstChild.textContent = league;
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
  });
  document.getElementById('clear-numbers').addEventListener('click', function () {
    chosen.length = 0;
    grid.querySelectorAll('button[data-n]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    renderTray();
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
    var reference = 'QRY-DEMO';
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
        if (data.week && data.fixtures && data.fixtures.length) {
          week = data.week;
          fixtures = data.fixtures;
        }
      } catch (err) { unreachable = true; }
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
