window.Sim = window.Sim || {};
(function () {
  const STANDARD_DELTAS = { newPct: 10, sameDayPt: 5, laterPt: 5, aovPct: 10, entryPricePct: 5 };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const L0 = () => ({ newPct: 0, sameDayPt: 0, laterPt: 0, aovPct: 0, entryPricePct: 0 });

  function applied(cat, period, levers) {
    const l = Object.assign(L0(), levers || {}); const later = cat.later[period - 1] || { rate: 0, aov: 0 };
    return {
      newN: cat.newCustomers * (1 + l.newPct / 100),
      entryPrice: cat.entryPrice * (1 + l.entryPricePct / 100),
      sameRate: clamp(cat.sameDay.rate + l.sameDayPt, 0, 100) / 100,
      sameAov: cat.sameDay.aov * (1 + l.aovPct / 100),
      laterRate: clamp(later.rate + l.laterPt, 0, 100) / 100,
      laterAov: later.aov * (1 + l.aovPct / 100)
    };
  }
  function ltv(cat, period, levers) {
    const a = applied(cat, period, levers); const sameDayPart = a.sameRate * a.sameAov, laterPart = a.laterRate * a.laterAov;
    return { entry: a.entryPrice, sameDayPart, laterPart, ltv: a.entryPrice + sameDayPart + laterPart };
  }
  function category(cat, period, levers) {
    const a = applied(cat, period, levers); const v = ltv(cat, period, levers); const addon = v.sameDayPart + v.laterPart;
    return { id: cat.id, name: cat.name, newN: a.newN, entryPrice: a.entryPrice, ltv: v.ltv, sameDayPart: v.sameDayPart, laterPart: v.laterPart,
      addonPerCustomer: addon, entryRevenue: a.newN * a.entryPrice, addonRevenue: a.newN * addon, revenue: a.newN * v.ltv };
  }
  function store(state, period, scenarioLevers) {
    const cogs = (state.store.cogsRate || 0) / 100;
    const cats = state.categories.map(c => category(c, period, scenarioLevers && scenarioLevers[c.id]));
    const revenue = cats.reduce((s, c) => s + c.revenue, 0); const newTotal = cats.reduce((s, c) => s + c.newN, 0);
    cats.forEach(c => { c.share = revenue > 0 ? c.revenue / revenue : 0; });
    const grossProfit = revenue * (1 - cogs); const fixedTotal = (state.store.fixedCostMonthly || 0) * 12 * period;
    const weightedLtv = newTotal > 0 ? revenue / newTotal : 0;
    const channels = (state.channels || []).map(ch => {
      const cpa = ch.newCustomers > 0 ? ch.cost / ch.newCustomers : null;
      return { id: ch.id, name: ch.name, newCustomers: ch.newCustomers, cost: ch.cost, cpa, payback: (cpa != null && cpa > 0) ? (weightedLtv * (1 - cogs)) / cpa : null };
    });
    return { period, newTotal, revenue, grossProfit, fixedTotal, operatingProfit: fixedTotal > 0 ? grossProfit - fixedTotal : null, weightedLtv, categories: cats, channels };
  }
  function solveRatePt(items, gap) {
    const totalN = items.reduce((s, c) => s + c.n, 0);
    const den = items.reduce((s, c) => s + c.n * c.aov, 0);
    if (!(den > 0)) return null;
    const f = pt => items.reduce((s, c) => s + c.n * c.aov * (clamp(c.rate + pt, 0, 100) - c.rate) / 100, 0);
    const from = totalN > 0 ? items.reduce((s, c) => s + c.n * c.rate, 0) / totalN : 0;
    const fMax = f(100), fMin = f(-100);
    let neededPt, feasible;
    if (gap > fMax) { neededPt = 100; feasible = false; }
    else if (gap < fMin) { neededPt = -100; feasible = false; }
    else {
      let lo = -100, hi = 100;
      for (let n = 0; n < 60; n++) { const mid = (lo + hi) / 2; if (f(mid) < gap) lo = mid; else hi = mid; }
      neededPt = (lo + hi) / 2; feasible = true;
    }
    const to = totalN > 0 ? items.reduce((s, c) => s + c.n * clamp(c.rate + neededPt, 0, 100), 0) / totalN : 0;
    return { neededPt, from, to, feasible };
  }
  function reverse(state, period, target) {
    if (target == null || !(target > 0)) return null;
    const i = period - 1; const cats = state.categories; const sum = f => cats.reduce((s, c) => s + f(c), 0);
    const current = store(state, period).revenue; const gap = target - current; const totalNew = sum(c => c.newCustomers);
    const out = { target, current, gap, levers: {} };
    const k = current > 0 ? target / current : null;
    out.levers.new = k == null ? null : { neededCount: totalNew * (k - 1), from: totalNew, to: totalNew * k, feasible: true };
    out.levers.sameDay = solveRatePt(cats.map(c => ({ n: c.newCustomers, rate: c.sameDay.rate, aov: c.sameDay.aov })), gap);
    const lt = c => c.later[i] || { rate: 0, aov: 0 };
    out.levers.later = solveRatePt(cats.map(c => ({ n: c.newCustomers, rate: lt(c).rate, aov: lt(c).aov })), gap);
    const addonBase = sum(c => c.newCustomers * (c.sameDay.rate / 100 * c.sameDay.aov + lt(c).rate / 100 * lt(c).aov));
    out.levers.aov = addonBase > 0 ? { neededPct: gap / addonBase * 100, feasible: true } : null;
    const entryBase = sum(c => c.newCustomers * c.entryPrice);
    out.levers.entryPrice = entryBase > 0 ? { neededPct: gap / entryBase * 100, feasible: true } : null;
    return out;
  }
  function reachRate(state, period, scenario) {
    const t = state.plan.targetRevenue[period - 1]; if (!(t > 0)) return null;
    return store(state, period, scenario && scenario.levers).revenue / t * 100;
  }
  function evenSplit(state, period, target) {
    const r = reverse(state, period, target); const levers = {}; if (!r) return levers;
    const n = ['new', 'sameDay', 'later', 'aov', 'entryPrice'].filter(k => r.levers[k]).length;
    state.categories.forEach(c => {
      const l = L0();
      if (n) {
        if (r.levers.new && r.levers.new.from > 0) l.newPct = (r.levers.new.to / r.levers.new.from - 1) * 100 / n;
        if (r.levers.sameDay) l.sameDayPt = r.levers.sameDay.neededPt / n;
        if (r.levers.later) l.laterPt = r.levers.later.neededPt / n;
        if (r.levers.aov) l.aovPct = r.levers.aov.neededPct / n;
        if (r.levers.entryPrice) l.entryPricePct = r.levers.entryPrice.neededPct / n;
      }
      levers[c.id] = l;
    });
    return levers;
  }
  function crmTargets(state, period, scenario) {
    return state.categories.map(c => {
      const a = applied(c, period, scenario && scenario.levers && scenario.levers[c.id]);
      const rate = 1 - (1 - a.sameRate) * (1 - a.laterRate); const expected = a.sameRate * a.sameAov + a.laterRate * a.laterAov;
      return { name: c.name, period, entryPrice: Math.round(a.entryPrice), newCustomers: Math.round(a.newN),
        addonRate: Math.round(rate * 1000) / 10, addonAov: rate > 0 ? Math.round(expected / rate) : 0 };
    });
  }
  Sim.calc = { STANDARD_DELTAS, applied, ltv, category, store, reverse, reachRate, evenSplit, crmTargets };
})();
