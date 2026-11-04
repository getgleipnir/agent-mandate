/* Gleipnir site: reveal on scroll and the example check. No tracking, no network calls. */
(function () {
  'use strict';
  var rv = document.querySelectorAll('.rv');
  if (rv.length && 'IntersectionObserver' in window && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    document.documentElement.classList.add('js');
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rv.forEach(function (el) { io.observe(el); });
  }
  var tabsEl = document.getElementById('scen-tabs');
  if (!tabsEl) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var S = [
    { n: 'Pay a supplier', top: 'payment 7Q-20418 · before it is sent', who: 'Check as the bank',
      rows: [['company', 'Nordhafen Logistik GmbH'], ['AI agent', 'ap-agent v2 · pays suppliers'], ['signed by', 'K. Berger · may sign for the company'], ['limit', '€25,000 per payment'], ['payment', '€18,400.00 · SEPA'], ['to', 'Brenner Stahl AG'], ['IBAN', 'AT61 1904 3002 3457 3201']],
      steps: ['Signature is real', 'K. Berger may sign for this company', 'Still valid: not expired, not switched off', 'Payee is on the mandate', 'Amount is within the €25,000 limit'],
      ok: ['Allowed. The bank sends the payment.', 'allowed'],
      alt: [{ l: 'Pay someone new', u: 'New payee (undo)', edit: { 5: 'Kessler Metall GmbH', 6: 'DE44 5001 0517 5407 3249 31' }, step: 3, bad: 'Kessler Metall GmbH was never approved', v: 'Blocked. A new payee needs a new signature.', b: 'blocked' },
            { l: 'Raise to €48,000', u: 'Raised to €48,000 (undo)', edit: { 4: '€48,000.00 · SEPA' }, step: 4, bad: 'Amount is over the €25,000 limit', v: 'Sent to a person. Over the limit the company set.', b: 'to a person' }],
      note: '<b>Works today</b> with the open-source checker, in test setups.' },
    { n: 'Settle a debt', top: 'call with a collector · before it goes on', who: 'Check as the collector',
      rows: [['for', 'Jane Doe'], ['AI agent', 'Acme Assistant'], ['signed by', 'Jane Doe · as typed by the signer'], ['toward', 'Midwest Recovery Services'], ['may', 'Agree to a plan up to $200 a month'], ['the agent asks', 'A plan of $150 a month']],
      steps: ['Signature is real', 'The mandate names this company', 'Not expired, not revoked', 'The request is within what she signed'],
      ok: ['In scope. Your team still confirms it is Jane, as usual.', 'in scope'],
      alt: [{ l: 'Offer $2,000 today', u: 'Offering $2,000 (undo)', edit: { 5: 'Settle for $2,000 today' }, step: 3, bad: 'Settling was never signed', v: 'Goes back to Jane. The agent has to ask her.', b: 'to a person' },
            { l: 'Jane revoked it', u: 'Revoked (undo)', edit: {}, step: 2, bad: 'Jane revoked this mandate', v: 'Stop. This agent no longer speaks for her.', b: 'revoked' }],
      note: '<b>Experimental:</b> a mandate link, checked in the browser.' },
    { n: 'Ask about a claim', top: 'call to a health plan · before any detail is shared', who: 'Check as the plan',
      rows: [['for', 'Harbor Family Clinic'], ['AI agent', 'Billing Assistant'], ['signed by', 'M. Okafor · practice manager'], ['toward', 'Northline Health Plan'], ['may', 'Ask about claim status for this clinic'], ['the agent asks', 'Status of a claim']],
      steps: ['Signature is real', 'The mandate names this plan', 'Not expired, not revoked', 'The request is within what the clinic signed'],
      ok: ['In scope. The plan still applies its own rules.', 'in scope'],
      alt: [{ l: 'Change payment details', u: 'Changing details (undo)', edit: { 5: 'Change the clinic’s bank details' }, step: 3, bad: 'Changing details was never signed', v: 'Refused. The clinic did not allow this.', b: 'refused' }],
      note: '<b>Open work:</b> no plan checks this yet, and health data needs its own review.' },
    { n: 'Change a booking', top: 'request to an airline · before it is changed', who: 'Check as the airline',
      rows: [['for', 'Mara Novak'], ['AI agent', 'Trip Assistant'], ['signed by', 'Mara Novak · with a passkey'], ['toward', 'airline.example'], ['may', 'Change dates, up to $70 extra'], ['the agent asks', 'New date, $45 extra']],
      steps: ['Signature is real', 'The agent holds the key named on the mandate', 'The mandate names this domain', 'Not expired, not revoked', 'The price is within the limit'],
      ok: ['Allowed. The airline makes the change.', 'allowed'],
      alt: [{ l: 'Upgrade for $900', u: 'Upgrade for $900 (undo)', edit: { 5: 'Business class, $900 extra' }, step: 4, bad: '$900 is over the $70 limit', v: 'Goes to Mara. She can approve this one change.', b: 'to a person' }],
      note: '<b>Draft:</b> the agent protocol profile in spec 0.6.' }
  ];
  var rec = document.getElementById('rec'), list = document.getElementById('checks'), verdict = document.getElementById('verdict'), badge = document.getElementById('badge'), top = document.getElementById('card-top-t'), acts = document.getElementById('card-actions'), note = document.getElementById('card-note');
  var cur = 0, on = -1, timers = [];
  function txt(tag, t, c) { var e = document.createElement(tag); e.textContent = t; if (c) e.className = c; return e; }
  function drawRows() {
    var s = S[cur], a = on >= 0 ? s.alt[on] : null; rec.textContent = '';
    s.rows.forEach(function (r, i) { rec.appendChild(txt('dt', r[0])); var ed = a && a.edit[i]; rec.appendChild(txt('dd', ed || r[1], ed ? 'edited' : '')); });
  }
  function run() {
    timers.forEach(clearTimeout); timers = []; list.textContent = '';
    var s = S[cur], a = on >= 0 ? s.alt[on] : null; drawRows();
    var items = s.steps.map(function (t, i) {
      var bad = a && a.step === i, li = document.createElement('li');
      li.dataset.final = bad ? 'fail' : 'pass'; li.className = 'wait';
      li.appendChild(txt('span', bad ? '✕' : '✓', 'mark')); li.appendChild(txt('span', bad ? a.bad : t)); list.appendChild(li); return li;
    });
    verdict.className = 'verdict'; verdict.textContent = 'Checking…'; badge.className = 'badge'; badge.textContent = 'checking';
    function finish() { verdict.className = 'verdict ' + (a ? 'fail' : 'pass'); verdict.textContent = a ? a.v : s.ok[0]; badge.className = 'badge ' + (a ? 'fail' : 'pass'); badge.textContent = a ? a.b : s.ok[1]; }
    if (reduce) { items.forEach(function (li) { li.className = li.dataset.final; }); finish(); return; }
    items.forEach(function (li, i) { timers.push(setTimeout(function () { li.className = li.dataset.final; }, 180 * (i + 1))); });
    timers.push(setTimeout(finish, 180 * (items.length + 1)));
  }
  function drawActs() {
    var s = S[cur]; acts.textContent = '';
    var go = txt('button', s.who, 'chip go'); go.type = 'button'; go.addEventListener('click', run); acts.appendChild(go);
    s.alt.forEach(function (a, i) {
      var b = txt('button', on === i ? a.u : a.l, 'chip'); b.type = 'button'; b.setAttribute('aria-pressed', String(on === i));
      b.addEventListener('click', function () { on = on === i ? -1 : i; drawActs(); run(); }); acts.appendChild(b);
    });
  }
  function select(i, focus) {
    cur = i; on = -1;
    Array.prototype.forEach.call(tabsEl.children, function (b, j) { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; if (j === i && focus) b.focus(); });
    top.textContent = S[i].top; note.innerHTML = S[i].note + ' Made-up data. Runs in your browser, nothing is sent.';
    drawActs(); run();
  }
  S.forEach(function (s, i) {
    var b = txt('button', s.n); b.type = 'button'; b.setAttribute('role', 'tab');
    b.addEventListener('click', function () { select(i); });
    b.addEventListener('keydown', function (e) { var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); select((i + d + S.length) % S.length, true); } });
    tabsEl.appendChild(b);
  });
  select(0);
})();
