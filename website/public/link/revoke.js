/* Revocation for mandate links: a separate key in this browser, named by the link's status address. */
(function () {
  'use strict';
  var input = document.getElementById('status-url'), done = document.getElementById('done'), list = document.getElementById('my-links'), wrap = document.getElementById('my-links-wrap');
  if (!input || !window.indexedDB || !window.crypto || !crypto.subtle) return;
  var cur = null;
  function db() { return new Promise(function (ok, no) { var r = indexedDB.open('gleipnir-link-revoke', 1); r.onupgradeneeded = function () { r.result.createObjectStore('links', { keyPath: 'slot' }); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); }
  function put(v) { return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction('links', 'readwrite'); t.objectStore('links').put(v); t.oncomplete = ok; t.onerror = function () { no(t.error); }; }); }); }
  function all() { return db().then(function (d) { return new Promise(function (ok, no) { var r = d.transaction('links').objectStore('links').getAll(); r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); }); }
  function b64(u) { return btoa(String.fromCharCode.apply(null, new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function prep() {
    var alg = { name: 'ECDSA', namedCurve: 'P-256' };
    return crypto.subtle.generateKey(alg, false, ['sign', 'verify']).then(function (k) {
      return crypto.subtle.exportKey('jwk', k.publicKey).then(function (j) {
        var canon = '{"crv":"P-256","kty":"EC","x":"' + j.x + '","y":"' + j.y + '"}';
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon)).then(function (h) {
          var slot = b64(crypto.getRandomValues(new Uint8Array(12))) + '.' + b64(h);
          cur = { slot: slot, key: k.privateKey, x: j.x, y: j.y };
          input.value = location.origin + '/api/link-status/' + slot;
        });
      });
    }).catch(function () { cur = null; });
  }
  function revoke(l, btn, st) {
    btn.disabled = true; st.textContent = 'Revoking…';
    crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, l.key, new TextEncoder().encode('gleipnir/link-revoke/v0.1\n' + l.slot)).then(function (sig) {
      return fetch('/api/link-revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slot: l.slot, x: l.x, y: l.y, sig: b64(sig) }) });
    }).then(function (r) {
      if (!r.ok) throw new Error('The server answered ' + r.status);
      l.revoked = true; return put(l);
    }).then(function () { st.textContent = 'Revoked. Open the link again to see it.'; btn.hidden = true; }).catch(function (e) { st.textContent = 'Not revoked: ' + e.message + '. Try again.'; btn.disabled = false; });
  }
  function draw() {
    return all().then(function (ls) {
      ls = ls.filter(function (l) { return l.url; }).sort(function (a, b) { return b.at - a.at; }).slice(0, 10);
      list.textContent = ''; wrap.hidden = !ls.length;
      ls.forEach(function (l) {
        var li = document.createElement('li'), a = document.createElement('a'), st = document.createElement('span'), btn = document.createElement('button');
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Code ' + l.code;
        btn.type = 'button'; btn.textContent = 'Revoke'; btn.hidden = !!l.revoked; st.className = 'rv-st'; st.textContent = l.revoked ? 'Revoked' : '';
        btn.addEventListener('click', function () { revoke(l, btn, st); });
        li.appendChild(a); li.appendChild(btn); li.appendChild(st); list.appendChild(li);
      });
    });
  }
  new MutationObserver(function () {
    if (done.hidden || !cur) return;
    var url = document.getElementById('link').value;
    if (!url || url.indexOf('#') < 0) return;
    if (document.getElementById('json').value.indexOf(cur.slot) < 0) return;
    var l = cur; l.url = url; l.code = document.getElementById('code').textContent; l.at = Date.now();
    put(l).then(draw).then(prep);
  }).observe(done, { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true, characterData: true });
  prep(); draw().catch(function () {});
})();
