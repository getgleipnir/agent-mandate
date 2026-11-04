/* Gleipnir site: use-case examples. No tracking, no network calls. */
(function () {
  'use strict';
  var list = document.querySelector('[role=tablist]');
  if (!list) return;
  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role=tab]'));
  function show(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = document.getElementById(t.getAttribute('aria-controls'));
      p.hidden = !on;
      if (on) {
        var ink = p.querySelectorAll('.ink');
        ink.forEach(function (i) { i.style.animation = 'none'; void i.getBoundingClientRect(); i.style.animation = ''; });
      }
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); show(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  document.querySelectorAll('.ask').forEach(function (ask) {
    var v = ask.querySelector('.verdict');
    ask.querySelectorAll('.req').forEach(function (b) {
      b.addEventListener('click', function () {
        ask.querySelectorAll('.req').forEach(function (x) { x.classList.toggle('on', x === b); });
        v.className = 'verdict ' + b.dataset.tone;
        v.querySelector('b').textContent = b.dataset.v;
        v.querySelector('span').textContent = b.dataset.w;
      });
    });
  });
})();
