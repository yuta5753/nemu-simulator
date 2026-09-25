window.Sim = window.Sim || {};
(function () {
  const STANDARD_DELTAS = { newPct: 10, sameDayPt: 5, laterPt: 5, aovPct: 10, entryPricePct: 5 };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const L0 = () => ({ newPct: 0, sameDayPt: 0, laterPt: 0, aovPct: 0, entryPricePct: 0 });

  function applied(cat, period, levers) {
    const l = Object.assign(L0(), levers || {}); const later = cat.later[period - 1] || { rate: 0, aov: 0 };
    return {
      newN: Math.max(0, cat.newCustomers) * (1 + l.newPct / 100),
      entryPrice: Math.max(0, cat.entryPrice) * (1 + l.entryPricePct / 100),
      sameRate: clamp(cat.sameDay.rate + l.sameDayPt, 0, 100) / 100,
      sameAov: Math.max(0, cat.sameDay.aov) * (1 + l.aovPct / 100),
      laterRate: clamp(later.rate + l.laterPt, 0, 100) / 100,
      laterAov: Math.max(0, later.aov) * (1 + l.aovPct / 100)
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
    const cogs = effectiveCogsRate(state) / 100;
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
  function effectiveCogsRate(state) {
    const m = state.mgmt;
    if (m && m.revenue > 0 && m.costs && m.costs.cogs != null) return Math.max(0, m.costs.cogs) / m.revenue * 100;
    return state.store.cogsRate || 0;
  }
  const nz = v => (v == null || isNaN(v)) ? null : v;
  const nn = v => { const x = nz(v); return x == null ? null : Math.max(0, x); };
  const div = (a, b) => (a == null || b == null || !(b > 0)) ? null : a / b;
  function mgmtCore(m) {
    m = m || {};
    const revenue = nn(m.revenue), buyers = nn(m.buyers), newBuyers = nn(m.newBuyers), newRevenue = nn(m.newRevenue);
    const existingRevenue = (revenue != null && newRevenue != null) ? revenue - newRevenue : null;
    const v = m.visits || {}; const vs = [nn(v.once), nn(v.twice), nn(v.threePlus)];
    const visitsTotal = vs.every(x => x != null) ? vs[0] + vs[1] + vs[2] : null;
    const c = m.costs || {}; const cogs = nn(c.cogs);
    const grossProfit = (revenue != null && cogs != null) ? revenue - cogs : null; const grossMarginPct = div(grossProfit, revenue);
    const costKeys = ['labor', 'rent', 'ads', 'other'];
    const costsClamped = { labor: nn(c.labor), rent: nn(c.rent), ads: nn(c.ads), other: nn(c.other) };
    const fixedCosts = costKeys.every(k => costsClamped[k] != null) ? costKeys.reduce((s, k) => s + costsClamped[k], 0) : null;
    const operatingProfit = (grossProfit != null && fixedCosts != null) ? grossProfit - fixedCosts : null;
    const breakEven = (fixedCosts != null && grossMarginPct > 0) ? fixedCosts / grossMarginPct : null;
    const prods = (m.products || []); const salesSum = prods.reduce((s, p) => s + (nn(p.sales) || 0), 0);
    const products = prods.map(p => {
      const sales = nn(p.sales), gm = nz(p.grossMarginPct);
      return { id: p.id, name: p.name, sales, grossMarginPct: gm, share: div(sales, salesSum), contribution: (sales != null && gm != null) ? sales * gm / 100 : null, contributionShare: null };
    });
    const contribSum = products.reduce((s, p) => s + (p.contribution || 0), 0);
    products.forEach(p => { p.contributionShare = (p.contribution != null && contribSum > 0) ? p.contribution / contribSum : null; });
    const f = m.funnel || {};
    const funnelClamped = { reservations: nn(f.reservations), visits: nn(f.visits), deals: nn(f.deals) };
    const funnel = { reservations: funnelClamped.reservations, visits: funnelClamped.visits, deals: funnelClamped.deals,
      visitRate: div(funnelClamped.visits, funnelClamped.reservations), dealRate: div(funnelClamped.deals, funnelClamped.visits) };
    const replacement = (m.replacement || []).map(r => {
      const cycleYears = nz(r.cycleYears), pastBuyers = nn(r.pastBuyers);
      return { id: r.id, name: r.name, cycleYears, pastBuyers, expectedBuyers: (cycleYears > 0 && pastBuyers != null) ? pastBuyers / cycleYears : null };
    });
    const inventory = nn(m.inventory), activeCustomers = nn(m.activeCustomers);
    return {
      revenue, buyers, newBuyers, newRevenue, itemsPerBuyer: nn(m.itemsPerBuyer), existingRevenue, aov: div(revenue, buyers), newShare: div(newRevenue, revenue),
      activeCustomers, visits: { once: vs[0], twice: vs[1], threePlus: vs[2] }, visitsTotal,
      repeatRate: visitsTotal > 0 ? (vs[1] + vs[2]) / visitsTotal : null, visitFrequency: div(buyers, activeCustomers), dormant: nn(m.dormant),
      cogs, grossProfit, grossMarginPct, costs: costsClamped,
      laborPct: div(costsClamped.labor, revenue), rentPct: div(costsClamped.rent, revenue), adsPct: div(costsClamped.ads, revenue), otherPct: div(costsClamped.other, revenue),
      fixedCosts, operatingProfit, opMarginPct: div(operatingProfit, revenue), breakEven, safetyMargin: (breakEven != null && revenue > 0) ? (revenue - breakEven) / revenue : null,
      inventory, inventoryTurnMonths: (inventory != null && cogs > 0) ? inventory / (cogs / 12) : null,
      products, funnel, replacement
    };
  }
  function mgmt(state) {
    const m = state.mgmt || {}; const cur = mgmtCore(m);
    cur.available = cur.revenue != null; cur.prev = m.prev ? mgmtCore(m.prev) : null; cur.channels = store(state, 1).channels;
    return cur;
  }
  function consistency(state) {
    const m = mgmt(state);
    const entryNewTotal = state.categories.reduce((s, c) => s + Math.max(0, c.newCustomers), 0);
    const entryNewRevenue = state.categories.reduce((s, c) => { const a = applied(c, 1); return s + a.newN * (a.entryPrice + a.sameRate * a.sameAov); }, 0);
    return { entryNewTotal, entryNewRevenue, newBuyers: m.newBuyers, newRevenue: m.newRevenue,
      newBuyersRatio: div(entryNewTotal, m.newBuyers), newRevenueRatio: div(entryNewRevenue, m.newRevenue) };
  }
  function mgmtLeverage(state) {
    const m = mgmt(state); if (m.operatingProfit == null || m.grossMarginPct == null) return null;
    const items = [
      { key: 'revenue', label: '売上 +10%', delta: m.revenue * 0.10 * m.grossMarginPct },
      { key: 'gm', label: '粗利率 +1pt', delta: m.revenue * 0.01 },
      { key: 'labor', label: '人件費 −5%', delta: (m.costs.labor || 0) * 0.05 },
      { key: 'ads', label: '広告費 −10%', delta: (m.costs.ads || 0) * 0.10 }
    ].sort((a, b) => b.delta - a.delta);
    return { base: m.operatingProfit, items, top: items[0] };
  }
  function requiredRevenue(state) {
    const m = mgmt(state); const rp = state.plan.requiredProfit;
    if (rp == null || m.fixedCosts == null || !(m.grossMarginPct > 0) || m.revenue == null) return null;
    const required = (m.fixedCosts + rp) / m.grossMarginPct; const g = state.plan.existingGrowthPct || 0;
    const existingForecast = m.existingRevenue != null ? m.existingRevenue * (1 + g / 100) : null;
    return { required, current: m.revenue, gap: required - m.revenue, existingForecast,
      newTarget: existingForecast != null ? Math.max(0, required - existingForecast) : null, grossMarginPct: m.grossMarginPct, fixedCosts: m.fixedCosts };
  }
  Sim.calc = { STANDARD_DELTAS, applied, ltv, category, store, reverse, reachRate, evenSplit, crmTargets, effectiveCogsRate, mgmtCore, mgmt, consistency, mgmtLeverage, requiredRevenue };
})();
