/* NovaCTRL Mobile tools: the local nav. On phones the page name opens the list of tools.
   Links from the old one-page layout (tools/#capacity and so on) go to the tool's own page. */
(function () {
  "use strict";
  var OLD = { pt: "pt", lookup: "pt", chart: "pt", shsc: "superheat-subcooling", glide: "glide",
    altitude: "altitude", capacity: "capacity", airside: "capacity", sources: "sources" };
  var h = location.hash.replace(/^#/, "");
  if (h && Object.prototype.hasOwnProperty.call(OLD, h) && /\/tools\/(index\.html)?$/.test(location.pathname)) {
    location.replace(OLD[h] + "/" + (/index\.html$/.test(location.pathname) ? "index.html" : ""));
    return;
  }
  var ln = document.getElementById("localnav"), btn = document.getElementById("ln-menu");
  if (!ln || !btn) return;
  function set(open) { ln.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); }
  btn.addEventListener("click", function () { set(!ln.classList.contains("open")); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  document.addEventListener("click", function (e) { if (ln.classList.contains("open") && !ln.contains(e.target)) set(false); });
  window.addEventListener("pageshow", function () { set(false); });
})();
