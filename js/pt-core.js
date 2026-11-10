/* NovaCTRL PT tool: the math. No DOM here, so the same file runs in the browser and under node for the tests.
   Every formula names where it comes from. */
(function (root) {
  "use strict";

  var ATM_SEA = 14.695949;          // psia, 1 standard atmosphere (101.325 kPa)
  var PSI_PER_INHG = 0.4911542;     // 1 inHg at 32 F, in psi
  var KPA_PER_PSI = 6.894757293168;

  /* ---------- site pressure ----------
     ASHRAE Handbook, Fundamentals, Ch. 1 (Psychrometrics), standard atmosphere:
     p = 14.696 (1 - 6.8754e-6 Z)^5.2559, Z in ft, p in psia. Same curve as the U.S. Standard Atmosphere, 1976. */
  function atmFromAltitude(ft) {
    return 14.696 * Math.pow(1 - 6.8754e-6 * ft, 5.2559);
  }
  function altitudeFromAtm(psia) {
    return (1 - Math.pow(psia / 14.696, 1 / 5.2559)) / 6.8754e-6;
  }

  /* ---------- pressure units -> psia ---------- */
  function toPsia(v, unit, atm) {
    switch (unit) {
      case "psig": return v + atm;
      case "psia": return v;
      case "kpag": return v / KPA_PER_PSI + atm;
      case "barg": return v * 100 / KPA_PER_PSI + atm;
      case "inhg": return atm - v * PSI_PER_INHG;          // inches of mercury below atmosphere
      default: return NaN;
    }
  }
  function fromPsia(p, unit, atm) {
    switch (unit) {
      case "psig": return p - atm;
      case "psia": return p;
      case "kpag": return (p - atm) * KPA_PER_PSI;
      case "barg": return (p - atm) * KPA_PER_PSI / 100;
      case "inhg": return (atm - p) / PSI_PER_INHG;
      default: return NaN;
    }
  }

  /* ---------- saturation tables ----------
     Each refrigerant carries bubble (liquid) and dew (vapor) pressure in hundredths of a psia, one row per degree F.
     Between rows we interpolate ln(p) linearly in T: vapor pressure is close to exponential in temperature,
     and at 1 F spacing the interpolation error is under 0.01 psi (checked against the equation of state). */
  function Fluid(rec) {
    this.rec = rec;
    this.id = rec.id;
    this.pure = rec.pure;
    this.tmin = rec.tmin;
    this.tmax = rec.tmax;
    this.lnb = rec.bub.map(function (x) { return Math.log(x / 100); });
    this.lnd = rec.pure ? this.lnb : rec.dew.map(function (x) { return Math.log(x / 100); });
  }
  // saturation pressure (psia) at T (F); side "bub" or "dew". NaN outside the table.
  Fluid.prototype.p = function (tF, side) {
    if (!(tF >= this.tmin && tF <= this.tmax)) return NaN;
    var a = side === "dew" ? this.lnd : this.lnb;
    var x = tF - this.tmin, i = Math.min(Math.floor(x), a.length - 2), f = x - i;
    return Math.exp(a[i] + f * (a[i + 1] - a[i]));
  };
  // saturation temperature (F) at absolute pressure; NaN outside the table.
  Fluid.prototype.t = function (psia, side) {
    var a = side === "dew" ? this.lnd : this.lnb;
    if (!(psia > 0)) return NaN;
    var l = Math.log(psia);
    if (l < a[0] || l > a[a.length - 1]) return NaN;
    var lo = 0, hi = a.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (a[m] <= l) lo = m; else hi = m; }
    return this.tmin + lo + (l - a[lo]) / (a[hi] - a[lo]);
  };
  // range of absolute pressure the table covers for a side
  Fluid.prototype.pRange = function (side) {
    var a = side === "dew" ? this.lnd : this.lnb;
    return [Math.exp(a[0]), Math.exp(a[a.length - 1])];
  };
  // is T inside the range checked against the published table?
  Fluid.prototype.inChecked = function (tF) {
    return tF >= this.rec.range[0] - 0.5 && tF <= this.rec.range[1] + 0.5;
  };
  // largest difference (psi) between this table, as interpolated here, and every published point
  Fluid.prototype.selfCheck = function (pts) {
    var worst = 0, n = 0, self = this;
    (pts || this.rec.pub).forEach(function (pt) {
      var p = self.p(pt[0], pt[1] === 1 ? "dew" : "bub");
      if (isNaN(p)) return;
      n++;
      worst = Math.max(worst, Math.abs(p - pt[2]));
    });
    return { n: n, worst: worst };
  };

  /* ---------- psychrometrics (I-P) ----------
     ASHRAE Handbook, Fundamentals, Ch. 1:
     saturation pressure of water vapor, Hyland & Wexler (1983) formulation, over ice below 32 F and over water above;
     humidity ratio W = 0.621945 pw / (p - pw);
     W from dry bulb and wet bulb (psychrometer equation, separate forms above and below freezing);
     enthalpy h = 0.240 t + W (1061 + 0.444 t), Btu per lb of dry air. */
  function pws(tF) {
    var T = tF + 459.67, lnp;
    if (tF < 32) {
      lnp = -1.0214165e4 / T - 4.8932428 - 5.3765794e-3 * T + 1.9202377e-7 * T * T +
        3.5575832e-10 * Math.pow(T, 3) - 9.0344688e-14 * Math.pow(T, 4) + 4.1635019 * Math.log(T);
    } else {
      lnp = -1.0440397e4 / T - 11.29465 - 2.7022355e-2 * T + 1.289036e-5 * T * T -
        2.4780681e-9 * Math.pow(T, 3) + 6.5459673 * Math.log(T);
    }
    return Math.exp(lnp); // psia
  }
  function wSat(tF, p) { var s = pws(tF); return 0.621945 * s / (p - s); }
  function wFromWetBulb(db, wb, p) {
    var ws = wSat(wb, p);
    if (wb >= 32) return ((1093 - 0.556 * wb) * ws - 0.240 * (db - wb)) / (1093 + 0.444 * db - wb);
    return ((1220 - 0.04 * wb) * ws - 0.240 * (db - wb)) / (1220 + 0.444 * db - 0.48 * wb);
  }
  function enthalpy(db, w) { return 0.240 * db + w * (1061 + 0.444 * db); }
  function relHum(db, w, p) { var pw = p * w / (0.621945 + w); return pw / pws(db); }
  function dewPoint(w, p) {
    // invert pws by bisection; good to 0.01 F
    var pw = p * w / (0.621945 + w), lo = -100, hi = 200;
    if (!(pw > 0)) return NaN;
    for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (pws(m) < pw) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function airState(db, wb, p) {
    if (wb > db + 1e-9) return null;
    var w = wFromWetBulb(db, wb, p);
    if (!(w >= 0)) return null;
    return { db: db, wb: wb, w: w, gr: w * 7000, h: enthalpy(db, w), rh: relHum(db, w, p), dp: dewPoint(w, p) };
  }

  /* ---------- air-side capacity ----------
     Standard air is 0.075 lb/ft3 (dry air at 14.696 psia and about 70 F) with cp 0.24 Btu/lb F (moist air ~0.244).
     Total   Btu/h = 4.5  x CFM x delta-h     (4.5  = 60 min/h x 0.075 lb/ft3)
     Sensible Btu/h = 1.08 x CFM x delta-T    (1.08 = 4.5 x 0.24)
     Latent  Btu/h = 0.68 x CFM x delta-grains (0.68 = 4.5 x 1061 / 7000), or total minus sensible.
     Air is thinner at altitude, so a fan moving the same CFM moves fewer pounds; the constants scale with
     site pressure / 14.696. */
  function capacity(cfm, ret, sup, p, correct) {
    var k = correct ? p / 14.696 : 1;
    var cT = 4.5 * k, cS = 1.08 * k, cL = 0.68 * k;
    var total = cT * cfm * (ret.h - sup.h);
    var sensible = cS * cfm * (ret.db - sup.db);
    var latent = total - sensible;
    var latentGr = cL * cfm * (ret.gr - sup.gr);
    return { cT: cT, cS: cS, cL: cL, total: total, sensible: sensible, latent: latent, latentGr: latentGr,
      shr: total !== 0 ? sensible / total : NaN, tons: total / 12000, dh: ret.h - sup.h, dt: ret.db - sup.db, dgr: ret.gr - sup.gr };
  }

  var api = { ATM_SEA: ATM_SEA, PSI_PER_INHG: PSI_PER_INHG, KPA_PER_PSI: KPA_PER_PSI,
    atmFromAltitude: atmFromAltitude, altitudeFromAtm: altitudeFromAtm, toPsia: toPsia, fromPsia: fromPsia,
    Fluid: Fluid, pws: pws, wSat: wSat, wFromWetBulb: wFromWetBulb, enthalpy: enthalpy, airState: airState,
    dewPoint: dewPoint, capacity: capacity };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PTCore = api;
})(this);
