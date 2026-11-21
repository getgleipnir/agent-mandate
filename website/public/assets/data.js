// Show the demo clip only when the file exists; otherwise keep the placeholder.
document.addEventListener("DOMContentLoaded", function () {
  var frame = document.getElementById("demo");
  if (!frame) return;
  var v = frame.querySelector("video");
  var src = v && v.querySelector("source");
  if (!v) return;
  v.addEventListener("loadeddata", function () { frame.classList.add("has-media"); });
  function fail() { v.style.display = "none"; }
  v.addEventListener("error", fail);
  if (src) src.addEventListener("error", fail);
});
