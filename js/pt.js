/* NovaCTRL PT tool: the page. All temperatures are kept in F and all pressures in psia inside; units are
   converted only at the inputs and outputs. */
(function () {
  "use strict";
  var C = window.PTCore, DATA = window.PT_DATA || [];
  if (!C || !DATA.length) return;

  var $ = function (id) { return document.getElementById(id); };
  var GROUPS = { ac: "A/C and heat pumps", ref: "Commercial refrigeration", nat: "Natural refrigerants" };
  var PUNITS = [["psig", "psig"], ["psia", "psia"], ["inhg", "inHg vac"], ["kpag", "kPa(g)"], ["barg", "bar(g)"]];

  var fluids = {};
  DATA.forEach(function (r) { fluids[r.id] = new C.Fluid(r); });

  var S = { ref: "R-410A", tunit: "F", dir: "p2t", siteMode: "alt", alt: 0, altUnit: "ft", baro: 29.92, psia: 14.696 };
  // Saved settings are trusted only key by key: own keys of S, the same type, finite numbers, known choices.
  var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var CHOICES = { tunit: ["F", "C"], dir: ["p2t", "t2p"], siteMode: ["alt", "baro", "psia"], altUnit: ["ft", "m"] };
  try {
    var saved = JSON.parse(localStorage.getItem("novactrl-pt") || "{}");
    if (saved && typeof saved === "object") Object.keys(saved).forEach(function (k) {
      var v = saved[k];
      if (!own(S, k) || typeof v !== typeof S[k]) return;
      if (typeof v === "number" && !isFinite(v)) return;
      if (own(CHOICES, k) && CHOICES[k].indexOf(v) < 0) return;
      S[k] = v;
    });
    if (!own(fluids, S.ref)) S.ref = "R-410A";
  } catch (e) { /* storage blocked: defaults are fine */ }
  function save() { try { localStorage.setItem("novactrl-pt", JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* ---------- helpers ---------- */
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : NaN; }
  function atm() {
    if (S.siteMode === "baro") return S.baro * C.PSI_PER_INHG;
    if (S.siteMode === "psia") return S.psia;
    var ft = S.altUnit === "m" ? S.alt / 0.3048 : S.alt;
    return C.atmFromAltitude(ft);
  }
  function siteFt() { return C.altitudeFromAtm(atm()); }
  function tIn(v) { return S.tunit === "C" ? v * 1.8 + 32 : v; }          // user temp -> F
  function tOut(f) { return S.tunit === "C" ? (f - 32) / 1.8 : f; }       // F -> user temp
  function dOut(d) { return S.tunit === "C" ? d / 1.8 : d; }              // F difference -> user difference
  function dIn(d) { return S.tunit === "C" ? d * 1.8 : d; }
  function fk(v) { return isFinite(v) ? Math.round(v).toLocaleString("en-US") : "–"; }
  function fx(v, n) { return isFinite(v) ? (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n) : "–"; }
  function fT(f, n) { return isFinite(f) ? fx(tOut(f), n === undefined ? 1 : n) + "°" + S.tunit : "–"; }
  function fD(d) { return isFinite(d) ? fx(dOut(d), 1) + "°" + S.tunit : "–"; }
  function unitLabel(u) { for (var i = 0; i < PUNITS.length; i++) if (PUNITS[i][0] === u) return PUNITS[i][1]; return u; }
  function pDec(u) { return u === "barg" ? 2 : 1; }
  // pressure for display; a gauge unit below atmosphere is shown as inches of vacuum, the way charts print it
  function fP(psia, u) {
    if (!isFinite(psia)) return "–";
    var a = atm();
    if ((u === "psig" || u === "kpag" || u === "barg") && psia < a) return fx(C.fromPsia(psia, "inhg", a), 1) + " inHg vac";
    if (u === "inhg" && psia >= a) return fx(psia - a, 1) + " psig";
    return fx(C.fromPsia(psia, u, a), pDec(u)) + " " + unitLabel(u);
  }
  var pending = {};
  function fresh(id) { var d = document.createElement("div"); pending[id] = d; return d; }
  function commit() {
    Object.keys(pending).forEach(function (id) {
      var live = $(id), d = pending[id];
      if (live.textContent !== d.textContent || live.innerHTML !== d.innerHTML) {
        clear(live); while (d.firstChild) live.appendChild(d.firstChild);
      }
    });
    pending = {};
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function stat(label, value, sub, cls) {
    var d = el("div", "stat" + (cls ? " " + cls : ""));
    d.appendChild(el("div", "k", label));
    var v = el("div", "v"), m = /^([+\-\u2212]?[\d.,]+)(\D.*)$/.exec(value);
    if (m) { v.appendChild(document.createTextNode(m[1])); v.appendChild(el("span", "u", m[2])); } else v.textContent = value;
    d.appendChild(v);
    if (sub) d.appendChild(el("div", "s", sub));
    return d;
  }
  function warn(text) { return el("p", "warn", text); }
  function F() { return fluids[S.ref]; }
  function rangeNote(f, tF) {
    if (!isFinite(tF) || f.inChecked(tF)) return null;
    return "Outside the " + fT(f.rec.range[0], 0) + " to " + fT(f.rec.range[1], 0) +
      " range checked against the published table. Still computed from the equation of state, but no published point backs it.";
  }
  function srcShort(f) {
    var r = f.rec, chk = f.selfCheck();
    return f.id + ": " + r.src + ". " + (r.calibrated ? "Matched to its " + chk.n + " printed points" : "Agrees within " + fx(chk.worst, 2) + " psi at " + chk.n + " printed points") + ". ";
  }
  function setSrc(id) {
    var n = $(id); if (!n) return;
    n.textContent = srcShort(F());
    var a = el("a", null, "Details in Sources"); a.href = "../sources/"; n.appendChild(a); n.appendChild(document.createTextNode("."));
  }

  /* ---------- static setup ---------- */
  (function fillSelects() {
    var sel = $("ref");
    if (sel) {
      Object.keys(GROUPS).forEach(function (g) {
        var og = document.createElement("optgroup"); og.label = GROUPS[g];
        DATA.filter(function (r) { return r.group === g; }).forEach(function (r) {
          var o = document.createElement("option"); o.value = r.id; o.textContent = r.id; og.appendChild(o);
        });
        sel.appendChild(og);
      });
      sel.value = S.ref;
    }
    Array.prototype.forEach.call(document.querySelectorAll("select.punit"), function (s) {
      PUNITS.forEach(function (u) { var o = document.createElement("option"); o.value = u[0]; o.textContent = u[1]; s.appendChild(o); });
      s.value = "psig";
    });
    $("site-mode").value = S.siteMode; $("site-alt").value = S.alt; $("site-alt-unit").value = S.altUnit;
    $("site-baro").value = S.baro; $("site-psia").value = S.psia;
  })();

  /* ---------- 1. lookup ---------- */
  function renderLookup() {
    var f = F(), out = fresh("lk-out"), a = atm();
    if (S.dir === "p2t") {
      var u = $("lk-punit").value, p = C.toPsia(num("lk-p"), u, a);
      if (!isFinite(p)) { out.appendChild(warn("Enter a pressure.")); return; }
      if (p <= 0) { out.appendChild(warn("That is below a perfect vacuum at this site.")); return; }
      if (u === "inhg" && num("lk-p") < 0) out.appendChild(warn("A negative vacuum is a positive pressure. Switch the unit to psig to read it the normal way."));
      var td = f.t(p, "dew"), tb = f.t(p, "bub");
      var abs = el("p", "caption", fx(p, 2) + " psia absolute at " + fx(a, 2) + " psia site pressure.");
      if (isNaN(td) && isNaN(tb)) {
        out.appendChild(warn("Outside this chart: " + f.id + " runs from " + fP(f.p(f.tmin, "dew"), u) + " to " + fP(f.p(f.tmax, "bub"), u) + "."));
        out.appendChild(abs); setSrc("lk-src"); return;
      }
      if (f.pure) {
        out.appendChild(stat("Saturation temperature", fT(tb), null, "big"));
      } else {
        var g = el("div", "stats");
        g.appendChild(stat("Dew point", fT(td), "Vapor side. Use for superheat.", "big low"));
        g.appendChild(stat("Bubble point", fT(tb), "Liquid side. Use for subcooling.", "big high"));
        g.appendChild(stat("Glide", fD(td - tb), "Average " + fT((td + tb) / 2)));
        out.appendChild(g);
      }
      out.appendChild(abs);
      if (!f.pure && (isNaN(td) || isNaN(tb))) out.appendChild(warn((isNaN(td) ? "Dew point" : "Bubble point") + " is off this chart (it runs " + fT(f.tmin, 0) + " to " + fT(f.tmax, 0) + ")."));
      var n = rangeNote(f, f.pure ? tb : (isNaN(td) ? tb : td)); if (n) out.appendChild(warn(n));
    } else {
      var t = tIn(num("lk-t")), pu = $("lk-tpunit").value;
      if (!isFinite(t)) { out.appendChild(warn("Enter a temperature.")); return; }
      var pb = f.p(t, "bub"), pd = f.p(t, "dew");
      if (isNaN(pb)) { out.appendChild(warn("Outside this chart: " + f.id + " runs from " + fT(f.tmin, 0) + " to " + fT(f.tmax, 0) + ".")); return; }
      if (f.pure) {
        out.appendChild(stat("Saturation pressure", fP(pb, pu), fx(pb, 2) + " psia", "big"));
      } else {
        var g2 = el("div", "stats");
        g2.appendChild(stat("Dew pressure", fP(pd, pu), fx(pd, 2) + " psia. Vapor at " + fT(t), "big low"));
        g2.appendChild(stat("Bubble pressure", fP(pb, pu), fx(pb, 2) + " psia. Liquid at " + fT(t), "big high"));
        out.appendChild(g2);
      }
      out.appendChild(el("p", "caption", "Gauge values at " + fx(a, 2) + " psia site pressure."));
      var n2 = rangeNote(f, t); if (n2) out.appendChild(warn(n2));
    }
    setSrc("lk-src");
  }

  /* ---------- 2. superheat / subcooling ---------- */
  function judge(val, target, tol) {
    if (!isFinite(target)) return null;
    var d = val - target;
    if (Math.abs(d) <= tol) return ["ok", "Within " + fD(tol) + " of target (" + (d >= 0 ? "+" : "") + fx(dOut(d), 1) + "°" + S.tunit + ")"];
    return [d > 0 ? "hi" : "lo", (d > 0 ? "High by " : "Low by ") + fx(dOut(Math.abs(d)), 1) + "°" + S.tunit];
  }
  function renderSHSC() {
    var f = F(), a = atm();
    // superheat
    var o1 = fresh("sh-out");
    var ps = C.toPsia(num("sh-p"), $("sh-punit").value, a), tl = tIn(num("sh-t"));
    var tsat = f.t(ps, "dew");
    if (!isFinite(ps) || !isFinite(tl)) o1.appendChild(warn("Enter suction pressure and line temperature."));
    else if (isNaN(tsat)) o1.appendChild(warn("That pressure is outside the " + f.id + " chart."));
    else {
      var sh = tl - tsat;
      var j = judge(sh, dIn(num("sh-target")), 3);
      o1.appendChild(stat("Superheat", fD(sh), (f.pure ? "Saturation " : "Dew point ") + fT(tsat) + " at " + fP(ps, $("sh-punit").value), "big low" + (j ? " j-" + j[0] : "")));
      if (j) o1.appendChild(el("p", "verdict " + j[0], j[1]));
      if (sh < 0) o1.appendChild(warn("Negative superheat: the line is colder than saturation. Check the reading, or you may have liquid returning to the compressor."));
      var n = rangeNote(f, tsat); if (n) o1.appendChild(warn(n));
    }
    // subcooling
    var o2 = fresh("sc-out");
    var pl = C.toPsia(num("sc-p"), $("sc-punit").value, a), tll = tIn(num("sc-t"));
    var tb = f.t(pl, "bub");
    if (!isFinite(pl) || !isFinite(tll)) o2.appendChild(warn("Enter liquid pressure and line temperature."));
    else if (isNaN(tb)) o2.appendChild(warn("That pressure is outside the " + f.id + " chart."));
    else {
      var sc = tb - tll;
      var j2 = judge(sc, dIn(num("sc-target")), 3);
      o2.appendChild(stat("Subcooling", fD(sc), (f.pure ? "Saturation " : "Bubble point ") + fT(tb) + " at " + fP(pl, $("sc-punit").value), "big high" + (j2 ? " j-" + j2[0] : "")));
      if (j2) o2.appendChild(el("p", "verdict " + j2[0], j2[1]));
      if (sc < 0) o2.appendChild(warn("Negative subcooling: the liquid line is warmer than saturation, so there is vapor in it. Check the reading and the charge."));
      var n2 = rangeNote(f, tb); if (n2) o2.appendChild(warn(n2));
    }
  }

  /* ---------- SVG helpers ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function niceStep(span, n) {
    var raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function axes(svg, box, xr, yr, xl, yl, xfmt, yfmt) {
    var X = function (v) { return box.x + (v - xr[0]) / (xr[1] - xr[0]) * box.w; };
    var Y = function (v) { return box.y + box.h - (v - yr[0]) / (yr[1] - yr[0]) * box.h; };
    var g = sv("g", { "class": "axis" });
    var xs = niceStep(xr[1] - xr[0], 6), ys = niceStep(yr[1] - yr[0], 5), v;
    for (v = Math.ceil(xr[0] / xs) * xs; v <= xr[1] + 1e-9; v += xs) {
      g.appendChild(sv("line", { x1: X(v), x2: X(v), y1: box.y, y2: box.y + box.h, "class": "grid" }));
      g.appendChild(sv("text", { x: X(v), y: box.y + box.h + 18, "text-anchor": "middle" }, xfmt(v)));
    }
    for (v = Math.ceil(yr[0] / ys) * ys; v <= yr[1] + 1e-9; v += ys) {
      g.appendChild(sv("line", { x1: box.x, x2: box.x + box.w, y1: Y(v), y2: Y(v), "class": "grid" }));
      g.appendChild(sv("text", { x: box.x - 8, y: Y(v) + 4, "text-anchor": "end" }, yfmt(v)));
    }
    g.appendChild(sv("text", { x: box.x + box.w, y: box.y + box.h + 38, "text-anchor": "end", "class": "lab" }, xl));
    g.appendChild(sv("text", { x: box.x, y: box.y - 10, "text-anchor": "start", "class": "lab" }, yl));
    svg.appendChild(g);
    return { X: X, Y: Y };
  }
  function plotBox(svg, h) {
    var w = Math.round(svg.getBoundingClientRect().width) || 640;
    w = Math.max(300, Math.min(900, w));
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    return { x: 50, y: 24, w: w - 70, h: h - 64 };
  }
  function path(pts) { return pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(""); }

  /* ---------- 3. glide ---------- */
  function renderGlide() {
    var f = F(), a = atm(), svg = clear($("glide-plot"));
    var t40 = 40, pd40 = f.p(t40, "dew"), g40 = t40 - f.t(pd40, "bub");
    var t100 = 100, pd100 = f.p(t100, "dew"), g100 = isFinite(pd100) ? t100 - f.t(pd100, "bub") : NaN;
    var txt;
    if (f.pure) txt = f.id + " is a single refrigerant. It boils and condenses at one temperature for a given pressure, so the bubble and dew points are the same and there is no glide.";
    else if (g40 < 0.5 && (isNaN(g100) || g100 < 0.5)) txt = f.id + " is an azeotropic or near-azeotropic blend. Its glide is under half a degree, small enough to treat it like a single refrigerant on gauges.";
    else txt = f.id + " is a zeotropic blend. At a constant pressure it starts to boil at the bubble point and finishes at the dew point, " + fD(g40) + " higher at a 40°F evaporator. Use the dew point for superheat, the bubble point for subcooling, and charge it as liquid so the mix stays right.";
    $("glide-text").textContent = txt;

    // plot: temperature against gauge pressure, both curves
    var unit = "psig", tTop = Math.min(f.tmax, f.id === "R-744" ? 85 : 130), tBot = Math.max(f.tmin, -40);
    var pLo = f.p(tBot, "dew"), pHi = f.p(tTop, "bub");
    var x0 = C.fromPsia(pLo, unit, a), x1 = C.fromPsia(pHi, unit, a);
    var box = plotBox(svg, 300);
    var ax = axes(svg, box, [x0, x1], [tOut(tBot), tOut(tTop)], "psig at your site", "Saturation °" + S.tunit,
      function (v) { return fx(v, 0); }, function (v) { return fx(v, 0); });
    var N = 80, bp = [], dp = [], i;
    for (i = 0; i <= N; i++) {
      var p = pLo + (pHi - pLo) * i / N, x = ax.X(C.fromPsia(p, unit, a));
      var tb = f.t(p, "bub"), td = f.t(p, "dew");
      if (isFinite(tb)) bp.push([x, ax.Y(tOut(Math.max(tBot, Math.min(tTop, tb))))]);
      if (isFinite(td)) dp.push([x, ax.Y(tOut(Math.max(tBot, Math.min(tTop, td))))]);
    }
    if (!f.pure && dp.length && bp.length) svg.appendChild(sv("path", { d: path(dp.concat(bp.slice().reverse())) + "Z", "class": "band" }));
    svg.appendChild(sv("path", { d: path(bp), "class": "curve bub" }));
    if (!f.pure) svg.appendChild(sv("path", { d: path(dp), "class": "curve dew" }));
    // marker at the lookup pressure
    var lp = $("lk-p") ? C.toPsia(num("lk-p"), $("lk-punit").value, a) : NaN;
    if (S.dir === "p2t" && isFinite(lp) && lp > pLo && lp < pHi) {
      var mx = ax.X(C.fromPsia(lp, unit, a));
      svg.appendChild(sv("line", { x1: mx, x2: mx, y1: box.y, y2: box.y + box.h, "class": "marker" }));
    }
    var leg = sv("g", { "class": "legend" });
    var lx = box.x + box.w - 6, ly = box.y + box.h - 12;
    if (f.pure) { leg.appendChild(sv("text", { x: lx, y: ly, "text-anchor": "end", "class": "t-bub" }, "Saturation")); }
    else {
      leg.appendChild(sv("text", { x: lx, y: ly - 18, "text-anchor": "end", "class": "t-dew" }, "Dew (vapor)"));
      leg.appendChild(sv("text", { x: lx, y: ly, "text-anchor": "end", "class": "t-bub" }, "Bubble (liquid)"));
    }
    svg.appendChild(leg);
    $("glide-cap").textContent = f.id + ": saturation temperature against gauge pressure" + (f.pure ? "." : ". The shaded band is the glide.") + (S.dir === "p2t" && isFinite(lp) ? " The line marks your lookup pressure." : "");

    // table at typical evaporator and condenser temperatures
    var tbl = clear($("glide-table"));
    var head = el("tr"); ["Dew point", "Pressure", "Bubble point", "Glide"].forEach(function (h) { head.appendChild(el("th", null, h)); });
    var th = el("thead"); th.appendChild(head); tbl.appendChild(th);
    var tb_ = el("tbody");
    [0, 20, 40, 50, 90, 100, 110, 120].forEach(function (t) {
      var p = f.p(t, "dew"); if (isNaN(p)) return;
      var b = f.t(p, "bub");
      var tr = el("tr");
      [fT(t, 0), fP(p, "psig"), fT(b), f.pure ? "0" : fD(t - b)].forEach(function (c) { tr.appendChild(el("td", null, c)); });
      tb_.appendChild(tr);
    });
    tbl.appendChild(tb_);
    setSrc("glide-src");
  }

  /* ---------- 4. altitude ---------- */
  function renderAltitude() {
    var f = F(), out = fresh("alt-out"), svg = clear($("alt-plot")), tbl = clear($("alt-table"));
    var u = $("alt-punit").value, side = f.pure ? "bub" : $("alt-side").value, v = num("alt-p");
    $("alt-side").disabled = f.pure;
    if (!isFinite(v)) { out.appendChild(warn("Enter a gauge reading.")); return; }
    var aSite = atm();
    var pSea = C.toPsia(v, u, C.ATM_SEA), pSite = C.toPsia(v, u, aSite);
    var tSea = f.t(pSea, side), tSite = f.t(pSite, side);
    var g = el("div", "stats");
    g.appendChild(stat("Sea-level chart says", fT(tSea), fx(pSea, 1) + " psia"));
    g.appendChild(stat("At your site", fT(tSite), fx(pSite, 1) + " psia at " + fx(siteFt(), 0) + " ft", "big"));
    g.appendChild(stat("Chart error", isFinite(tSea - tSite) ? (tSea - tSite >= 0 ? "+" : "") + fx(dOut(tSea - tSite), 1) + "°" + S.tunit : "–", "Reading the sea-level chart up here"));
    out.appendChild(g);
    if (Math.abs(siteFt()) < 50) out.appendChild(el("p", "caption", "Your site is set to sea level, so the two match. Set an elevation at the top of the page to see the difference."));

    var alts = [], ftMax = 10000, i;
    for (i = 0; i <= 20; i++) alts.push(i * 500);
    var temps = alts.map(function (ft) { return f.t(C.toPsia(v, u, C.atmFromAltitude(ft)), side); });
    var ok = temps.filter(isFinite);
    if (ok.length > 1) {
      var lo = Math.min.apply(null, ok.concat([tSea])), hi = Math.max.apply(null, ok.concat([tSea]));
      var pad = Math.max(0.5, (hi - lo) * 0.12);
      var box = plotBox(svg, 250);
      var ax = axes(svg, box, [0, ftMax], [tOut(lo - pad), tOut(hi + pad)], "Elevation, ft", "Saturation °" + S.tunit,
        function (x) { return x >= 1000 ? fx(x / 1000, 0) + "k" : fx(x, 0); }, function (y) { return fx(y, 1); });
      svg.appendChild(sv("line", { x1: box.x, x2: box.x + box.w, y1: ax.Y(tOut(tSea)), y2: ax.Y(tOut(tSea)), "class": "ref-line" }));
      svg.appendChild(sv("text", { x: box.x + box.w - 4, y: ax.Y(tOut(tSea)) - 6, "text-anchor": "end", "class": "lab" }, "sea-level chart"));
      var pts = []; alts.forEach(function (ft, k) { if (isFinite(temps[k])) pts.push([ax.X(ft), ax.Y(tOut(temps[k]))]); });
      svg.appendChild(sv("path", { d: path(pts), "class": "curve " + (side === "dew" ? "dew" : "bub") }));
      var sf = siteFt();
      if (sf >= 0 && sf <= ftMax && isFinite(tSite)) svg.appendChild(sv("circle", { cx: ax.X(sf), cy: ax.Y(tOut(tSite)), r: 5, "class": "dotm" }));
    }
    $("alt-cap").textContent = "True saturation temperature for " + fx(v, pDec(u)) + " " + unitLabel(u) + " on " + f.id + " (" + (side === "dew" ? "dew" : f.pure ? "saturation" : "bubble") + "), from sea level to 10,000 ft.";
    var head = el("tr"); ["Elevation", "Atmosphere", "Saturation", "Chart reads high by"].forEach(function (h) { head.appendChild(el("th", null, h)); });
    var th = el("thead"); th.appendChild(head); tbl.appendChild(th);
    var body = el("tbody");
    for (i = 0; i <= 10; i++) {
      var ft = i * 1000, aa = C.atmFromAltitude(ft), t = f.t(C.toPsia(v, u, aa), side), tr = el("tr");
      [fx(ft, 0) + " ft", fx(aa, 2) + " psia", fT(t), isFinite(t) ? fx(dOut(tSea - t), 1) + "°" : "–"].forEach(function (c) { tr.appendChild(el("td", null, c)); });
      body.appendChild(tr);
    }
    tbl.appendChild(body);
  }

  /* ---------- 5. air side ---------- */
  function renderAir() {
    var out = fresh("air-out"), fm = clear($("air-formulas")), p = atm();
    var cfm = num("air-cfm"), rdb = tIn(num("air-rdb")), rwb = tIn(num("air-rwb")), sdb = tIn(num("air-sdb")), swb = tIn(num("air-swb"));
    if (![cfm, rdb, rwb, sdb, swb].every(isFinite)) { out.appendChild(warn("Fill in airflow and both dry and wet bulbs.")); return; }
    var r = C.airState(rdb, rwb, p), s = C.airState(sdb, swb, p);
    if (rwb > rdb || swb > sdb) { out.appendChild(warn("Wet bulb can't be higher than dry bulb.")); return; }
    if (!r || !s) { out.appendChild(warn("That wet bulb is too low for the dry bulb. Check the reading.")); return; }
    var c = C.capacity(cfm, r, s, p, $("air-correct").checked);
    var g = el("div", "stats");
    g.appendChild(stat("Total", fk(c.total) + " Btu/h", fx(c.tons, 2) + " tons", "big"));
    g.appendChild(stat("Sensible", fk(c.sensible) + " Btu/h", "SHR " + fx(c.shr, 2)));
    g.appendChild(stat("Latent", fk(c.latent) + " Btu/h", "By grains: " + fk(c.latentGr) + " Btu/h"));
    out.appendChild(g);
    var g2 = el("div", "stats small");
    g2.appendChild(stat("Return", fx(r.h, 2) + " Btu/lb", fx(r.gr, 1) + " gr/lb · " + fx(r.rh * 100, 0) + "% RH · dew pt " + fT(r.dp)));
    g2.appendChild(stat("Supply", fx(s.h, 2) + " Btu/lb", fx(s.gr, 1) + " gr/lb · " + fx(s.rh * 100, 0) + "% RH · dew pt " + fT(s.dp)));
    g2.appendChild(stat("Temperature split", fD(c.dt), "Δh " + fx(c.dh, 2) + " Btu/lb · Δ " + fx(c.dgr, 1) + " gr"));
    out.appendChild(g2);
    if (c.total < 0) out.appendChild(warn("Supply enthalpy is higher than return. Check the probes, or the unit is heating."));
    if (s.rh > 1.005 || r.rh > 1.005) out.appendChild(warn("A reading is above 100% RH. Check the wet bulb."));
    var lines = [
      "Total = " + fx(c.cT, 3) + " × " + fx(cfm, 0) + " CFM × " + fx(c.dh, 2) + " Btu/lb = " + fk(c.total) + " Btu/h",
      "Sensible = " + fx(c.cS, 3) + " × " + fx(cfm, 0) + " CFM × " + fx(c.dt, 1) + "°F = " + fk(c.sensible) + " Btu/h",
      "Latent = total − sensible = " + fk(c.latent) + " Btu/h",
      "Latent check = " + fx(c.cL, 3) + " × " + fx(cfm, 0) + " CFM × " + fx(c.dgr, 1) + " gr = " + fk(c.latentGr) + " Btu/h"
    ];
    lines.forEach(function (l) { fm.appendChild(el("code", null, l)); });
    fm.appendChild(el("p", "caption", ($("air-correct").checked ? "Constants scaled by site pressure ÷ 14.696 = " + fx(p / 14.696, 3) + ". " : "Standard-air constants. ") +
      "Psychrometrics at " + fx(p, 2) + " psia. The two latent numbers won't match exactly. 1.08 uses the specific heat of dry air (0.24), while moist air runs about 0.244, so sensible reads a little low and total minus sensible leans a little high. The grains method is the closer of the two; the gap is normal."));
  }

  /* ---------- 6. full chart ---------- */
  function renderChart() {
    var f = F(), tbl = clear($("ch-table")), u = $("ch-punit").value, a = atm();
    var from = tIn(num("ch-from")), to = tIn(num("ch-to")), step = parseFloat($("ch-step").value);
    if (!isFinite(from)) from = f.tmin; if (!isFinite(to)) to = f.tmax;
    if (from > to) { var x = from; from = to; to = x; }
    var stepF = S.tunit === "C" ? step * 1.8 : step;
    var start = S.tunit === "C" ? tIn(Math.ceil(tOut(Math.max(from, f.tmin)) / step) * step) : Math.ceil(Math.max(from, f.tmin) / step) * step;
    var head = el("tr");
    head.appendChild(el("th", null, "°" + S.tunit));
    if (f.pure) head.appendChild(el("th", null, u === "inhg" ? "Pressure" : unitLabel(u)));
    else { var ul_ = u === "inhg" ? "" : " " + unitLabel(u); head.appendChild(el("th", "low", "Dew" + ul_)); head.appendChild(el("th", "high", "Bubble" + ul_)); }
    var thd = el("thead"); thd.appendChild(head); tbl.appendChild(thd);
    var body = el("tbody"), rows = 0;
    for (var t = start; t <= Math.min(to, f.tmax) + 1e-9 && rows < 400; t += stepF, rows++) {
      var tr = el("tr");
      tr.appendChild(el("td", null, fx(tOut(t), 0)));
      var vals = f.pure ? [f.p(t, "bub")] : [f.p(t, "dew"), f.p(t, "bub")];
      vals.forEach(function (p) {
        var vac = (u !== "psia" && u !== "inhg") && p < a;
        var below = u !== "psia" && p < a;
        var txt = below ? fx(C.fromPsia(p, "inhg", a), 1) + "\u2033 vac" : (u === "inhg" ? fx(p - a, 1) + " psig" : fx(C.fromPsia(p, u, a), pDec(u)));
        tr.appendChild(el("td", below ? "vac" : null, txt));
      });
      if (!f.inChecked(t)) tr.className = "unchecked";
      body.appendChild(tr);
    }
    tbl.appendChild(body);
    $("ch-head").textContent = f.id + " PT chart at " + fx(a, 2) + " psia site pressure. " +
      (u === "psia" ? "Absolute pressure." : "Values marked \u2033 vac are inches of mercury below atmosphere.") +
      " Gray rows are outside the range checked against the published table.";
    setSrc("ch-src");
  }

  /* ---------- 7. sources ---------- */
  function link(href, text) { var a = el("a", null, text); a.href = href; a.rel = "noopener noreferrer"; return a; }
  function renderSources() {
    var f = F(), r = f.rec, box = clear($("src-current"));
    box.appendChild(el("h3", null, f.id));
    var dl = el("dl", "facts");
    function row(k, v) { var d = el("div"); d.appendChild(el("dt", null, k)); var dd = el("dd"); if (typeof v === "string") dd.textContent = v; else dd.appendChild(v); d.appendChild(dd); dl.appendChild(d); }
    row("Composition", r.comp);
    row("Safety class", r.safety + " (ASHRAE Standard 34)");
    if (r.tc) row("Critical point", fT(r.tc));
    row("Chart range", fT(r.tmin, 0) + " to " + fT(r.tmax, 0));
    box.appendChild(dl);
    var chk = f.selfCheck();
    var p1 = el("p");
    p1.appendChild(el("strong", null, "Published table: "));
    p1.appendChild(link(r.url, r.src));
    p1.appendChild(document.createTextNode(". " + chk.n + " printed points from " + fT(r.range[0], 0) + " to " + fT(r.range[1], 0) + "."));
    box.appendChild(p1);
    var p2 = el("p");
    if (r.calibrated) p2.textContent = "The equation of state alone was off from this table by up to " + fx(r.rawMaxPsi, 2) + " psi (" + fx(dOut(r.rawMaxF), 2) + "°" + S.tunit + "), so this table is matched to the published values at every printed point and the equation of state only shapes the curve between them. Now: within " + fx(chk.worst, 2) + " psi of every printed point.";
    else p2.textContent = "The equation of state agrees with this table within " + fx(chk.worst, 2) + " psi at every printed point, about the rounding of the printed values, so it is used as computed.";
    box.appendChild(p2);
    if (r.src2) {
      var c2 = f.selfCheck(r.pub2);
      var p3 = el("p");
      p3.appendChild(el("strong", null, "Second check: "));
      p3.appendChild(link(r.url2, r.src2));
      p3.appendChild(document.createTextNode(". " + c2.n + " points, within " + fx(c2.worst, 2) + " psi."));
      box.appendChild(p3);
    }
    var p4 = el("p"); p4.appendChild(el("strong", null, "Equations of state: "));
    var ul = el("ul", "cites");
    r.eos.forEach(function (c) { ul.appendChild(el("li", null, c)); });
    r.mix.forEach(function (c) { ul.appendChild(el("li", null, "Mixture model: " + c)); });
    box.appendChild(p4); box.appendChild(ul);
    box.appendChild(el("p", "caption", "Computed with " + (window.PT_META ? window.PT_META.engine : "CoolProp") + " (Bell, Wronski, Quoilin and Lemort, Ind. Eng. Chem. Res. 53 (2014) 2498). Tables generated " + (window.PT_META ? window.PT_META.generated : "") + "."));

    // every refrigerant
    var tbl = clear($("src-table"));
    var head = el("tr"); ["Refrigerant", "Class", "Checked against", "Points", "Largest difference"].forEach(function (h) { head.appendChild(el("th", null, h)); });
    var th = el("thead"); th.appendChild(head); tbl.appendChild(th);
    var body = el("tbody"), total = 0, worst = 0, worstId = "", ind = { n: 0, f: 0, w: 0 }, mat = { n: 0, f: 0 }, sec = { n: 0, w: 0 };
    DATA.forEach(function (rec) {
      var fl = fluids[rec.id], c = fl.selfCheck(), tr = el("tr");
      total += c.n; if (c.worst > worst) { worst = c.worst; worstId = rec.id; }
      if (rec.calibrated) { mat.n += c.n; mat.f++; } else { ind.n += c.n; ind.f++; ind.w = Math.max(ind.w, c.worst); }
      if (rec.pub2) { var c2 = fl.selfCheck(rec.pub2); sec.n += c2.n; sec.w = Math.max(sec.w, c2.worst); }
      tr.appendChild(el("td", null, rec.id));
      tr.appendChild(el("td", null, rec.safety));
      var td = el("td"); td.appendChild(link(rec.url, rec.src)); tr.appendChild(td);
      tr.appendChild(el("td", null, String(c.n)));
      tr.appendChild(el("td", null, fx(c.worst, 2) + " psi" + (rec.calibrated ? " (matched)" : "")));
      body.appendChild(tr);
    });
    tbl.appendChild(body);
    var sc = $("selfcheck");
    sc.textContent = (worst <= 0.15 ? "Self-check passed. " : "Self-check FAILED. ") +
      ind.f + " refrigerants used as computed: " + ind.n + " published points, largest difference " + fx(ind.w, 2) + " psi. That is an independent check of the equations of state. " +
      mat.f + " refrigerants matched to their tables: " + mat.n + " points, all reproduced, which confirms the data file but proves nothing about the equation of state. " +
      "Second published sheets (R-32, R-455A): " + sec.n + " points, largest difference " + fx(sec.w, 2) + " psi.";
    sc.className = "selfcheck " + (worst <= 0.15 ? "ok" : "bad");
  }

  /* ---------- site bar ---------- */
  function renderSite() {
    var a = atm(), ft = siteFt();
    clear($("site-label")).appendChild(document.createTextNode(Math.abs(ft) < 50 ? "Sea level" : Math.round(ft).toLocaleString("en-US") + " ft"));
    $("site-label").appendChild(el("span", "bar-psia", " · " + fx(a, 2) + " psia"));
    $("site-alt-wrap").hidden = S.siteMode !== "alt";
    $("site-baro-wrap").hidden = S.siteMode !== "baro";
    $("site-psia-wrap").hidden = S.siteMode !== "psia";
    $("site-note").textContent = (siteMsg ? siteMsg + " " : "") + "Atmosphere " + fx(a, 3) + " psia (" + fx(a / C.PSI_PER_INHG, 2) + " inHg), about " + fx(ft, 0) + " ft. Every gauge reading on this page is taken relative to it.";
    Array.prototype.forEach.call(document.querySelectorAll(".tunit"), function (n) { n.textContent = "°" + S.tunit; });
    Array.prototype.forEach.call(document.querySelectorAll(".tdunit"), function (n) { n.textContent = "°" + S.tunit; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-tunit]"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.tunit === S.tunit)); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-dir]"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.dir === S.dir)); });
    if ($("p2t-in")) { $("p2t-in").hidden = S.dir !== "p2t"; $("t2p-in").hidden = S.dir !== "t2p"; }
  }

  function renderAll() {
    renderSite();
    if ($("lk-out")) renderLookup();
    if ($("sh-out")) renderSHSC();
    if ($("glide-plot")) renderGlide();
    if ($("alt-out")) renderAltitude();
    if ($("air-out")) renderAir();
    if ($("ch-table")) renderChart();
    if ($("src-current")) renderSources();
    commit(); save();
  }

  /* ---------- events ---------- */
  if ($("ref")) $("ref").addEventListener("change", function () { S.ref = this.value; renderAll(); });
  $("site-toggle").addEventListener("click", function () {
    var p = $("site-panel"), open = p.hidden; p.hidden = !open; this.setAttribute("aria-expanded", String(open));
  });
  $("site-mode").addEventListener("change", function () { S.siteMode = this.value; renderAll(); });
  var siteMsg = "";
  $("site-alt").addEventListener("input", function () {
    var v = parseFloat(this.value), m = S.altUnit === "m";
    if (!isFinite(v)) { siteMsg = "Enter an elevation."; renderAll(); return; }
    var ft = m ? v / 0.3048 : v, cl = Math.max(-1500, Math.min(15000, ft));
    siteMsg = cl !== ft ? "This tool covers -1,500 to 15,000 ft. Using " + fx(cl, 0) + " ft." : "";
    S.alt = m ? cl * 0.3048 : cl; renderAll();
  });
  $("site-alt-unit").addEventListener("change", function () {
    var to = this.value; if (to === S.altUnit) return;
    S.alt = to === "m" ? S.alt * 0.3048 : S.alt / 0.3048; S.altUnit = to;
    $("site-alt").value = fx(S.alt, 0); renderAll();
  });
  $("site-baro").addEventListener("input", function () {
    var v = parseFloat(this.value);
    if (isFinite(v) && v > 15 && v < 32) { S.baro = v; siteMsg = ""; } else siteMsg = "Station pressure has to be between 15 and 32 inHg. Still using " + fx(S.baro, 2) + ".";
    renderAll();
  });
  $("site-psia").addEventListener("input", function () {
    var v = parseFloat(this.value);
    if (isFinite(v) && v > 7 && v < 16) { S.psia = v; siteMsg = ""; } else siteMsg = "Atmosphere has to be between 7 and 16 psia. Still using " + fx(S.psia, 3) + ".";
    renderAll();
  });

  // temperature unit: convert what's typed so the readings stay the same
  var TEMP_INPUTS = ["lk-t", "sh-t", "sc-t", "air-rdb", "air-rwb", "air-sdb", "air-swb", "ch-from", "ch-to"];
  var DT_INPUTS = ["sh-target", "sc-target"];
  // Each input remembers its exact value in the other unit, so F -> C -> F gives back what was typed.
  function convertInputs(to) {
    function conv(id, fn) {
      var n = $(id); if (!n) return; var v = parseFloat(n.value);
      if (!isFinite(v)) return;
      var back = n.dataset.shown === n.value && n.dataset.other !== undefined && n.dataset.otherUnit === to ? n.dataset.other : null;
      var nv = back !== null ? back : fx(fn(v), 1).replace(/\.0$/, "");
      n.dataset.other = n.value; n.dataset.otherUnit = to === "C" ? "F" : "C";
      n.value = nv; n.dataset.shown = nv;
    }
    TEMP_INPUTS.forEach(function (id) { conv(id, function (v) { return to === "C" ? (v - 32) / 1.8 : v * 1.8 + 32; }); });
    DT_INPUTS.forEach(function (id) { conv(id, function (v) { return to === "C" ? v / 1.8 : v * 1.8; }); });
  }
  // The page ships with F defaults; a saved C preference converts them before the first render.
  if (S.tunit === "C") convertInputs("C");
  Array.prototype.forEach.call(document.querySelectorAll("[data-tunit]"), function (b) {
    b.addEventListener("click", function () {
      var to = this.dataset.tunit; if (to === S.tunit) return;
      convertInputs(to); S.tunit = to; renderAll();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-dir]"), function (b) {
    b.addEventListener("click", function () { S.dir = this.dataset.dir; renderAll(); });
  });
  // pressure unit selects: convert the value so the reading stays the same
  [["lk-punit", "lk-p"], ["sh-punit", "sh-p"], ["sc-punit", "sc-p"], ["alt-punit", "alt-p"]].forEach(function (pair) {
    var s = $(pair[0]); if (!s) return; s.dataset.prev = s.value;
    s.addEventListener("change", function () {
      var v = num(pair[1]), a = atm();
      if (isFinite(v)) { var p = C.toPsia(v, this.dataset.prev, a); $(pair[1]).value = fx(C.fromPsia(p, this.value, a), pDec(this.value)); }
      this.dataset.prev = this.value; renderAll();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("main input, main select"), function (n) {
    if (n.classList.contains("punit") && n.id !== "lk-tpunit" && n.id !== "ch-punit") return;
    n.addEventListener(n.tagName === "SELECT" || n.type === "checkbox" ? "change" : "input", renderAll);
  });

  var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if ($("glide-plot")) renderGlide(); if ($("alt-out")) { renderAltitude(); commit(); } }, 150); });

  /* ---------- print the full chart on its own ---------- */
  if ($("chart-print")) $("chart-print").addEventListener("click", function () {
    var root = document.createElement("div"); root.id = "print-root";
    root.appendChild(el("h1", null, F().id + " PT chart"));
    ["ch-head", "ch-table", "ch-src"].forEach(function (id) { var c = $(id).cloneNode(true); c.removeAttribute("id"); root.appendChild(c); });
    document.body.appendChild(root); document.body.classList.add("printing");
    window.print();
  });
  window.addEventListener("afterprint", function () {
    document.body.classList.remove("printing"); var r = $("print-root"); if (r) r.parentNode.removeChild(r);
  });

  renderAll();
})();
