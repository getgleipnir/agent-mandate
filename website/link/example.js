/* Fills the form with a made-up example. Sends nothing. */
(function () {
  'use strict';
  var b = document.getElementById('example');
  if (!b) return;
  var v = { principal: 'Jane Doe', 'agent-id': 'acme-assistant', 'agent-name': 'Acme Assistant', counterparty: 'Midwest Recovery Services', actions: 'Discuss my account\nAgree to a payment plan up to $200 a month', amount: '200', currency: 'USD' };
  b.addEventListener('click', function () {
    Object.keys(v).forEach(function (k) { var e = document.getElementById(k); if (e) { e.value = v[k]; e.dispatchEvent(new Event('input', { bubbles: true })); } });
    document.getElementById('sign-device').scrollIntoView({ block: 'center' });
  });
})();
