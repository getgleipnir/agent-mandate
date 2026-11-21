// getgleipnir.com: nav state, HUD timecode, reveal on scroll, videos that load only if the file exists.
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  // Attach a source only if the file is really there, so a missing clip never shows a broken box.
  function loadVideo(video, src, onOk) {
    fetch(src, { method: "HEAD" }).then(function (r) {
      if (!r.ok) return;
      video.src = src;
      video.addEventListener("loadeddata", onOk, { once: true });
      video.load();
    }).catch(function () {});
  }

  onReady(function () {
    // nav background after scrolling
    var top = document.getElementById("top");
    function navState() { if (top) top.classList.toggle("scrolled", window.scrollY > 40); }
    navState();
    window.addEventListener("scroll", navState, { passive: true });

    // hero background video
    var hero = document.getElementById("hero");
    var hv = hero && hero.querySelector("video");
    if (hv && hv.dataset.src && !reduce) {
      loadVideo(hv, hv.dataset.src, function () {
        hero.classList.add("has-video");
        var p = hv.play(); if (p && p.catch) p.catch(function () {});
      });
    }

    // HUD timecode
    var tc = document.getElementById("tc");
    if (tc) {
      var start = Date.now() - (14 * 60 + 32) * 1000;
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      var tick = function () {
        var ms = Date.now() - start, s = Math.floor(ms / 1000);
        tc.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + ":" + pad(Math.floor((ms % 1000) / 33.4));
      };
      tick();
      if (!reduce) setInterval(tick, 100);
    }

    // rotating task label
    var task = document.getElementById("task");
    var tasks = ["01 · strip wire ends at wall box", "02 · prepare wires", "03 · connect wires to terminals", "04 · mount and tighten screws", "05 · rework terminals, remount"];
    if (task && !reduce) {
      var i = 2;
      setInterval(function () { i = (i + 1) % tasks.length; task.textContent = tasks[i]; }, 3200);
    }

    // sample clips: load if present, play on hover or when in view on touch screens
    var hoverable = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    Array.prototype.forEach.call(document.querySelectorAll(".clip"), function (fig) {
      var v = fig.querySelector("video");
      if (!v || !fig.dataset.src) return;
      loadVideo(v, fig.dataset.src, function () {
        fig.classList.add("ready");
        if (!hoverable && !reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      });
      if (hoverable) {
        fig.addEventListener("mouseenter", function () { if (fig.classList.contains("ready")) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } });
        fig.addEventListener("mouseleave", function () { v.pause(); });
      }
    });

    // reveal on scroll
    var items = document.querySelectorAll(".rv");
    if (!("IntersectionObserver" in window) || reduce) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    Array.prototype.forEach.call(items, function (el) { io.observe(el); });
  });
})();
